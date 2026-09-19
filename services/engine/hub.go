package main

import (
	"encoding/json"
	"log"
	"time"
)

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client

	events    []Event
	cursor    int
	isPlaying bool
	filters   map[EventType]bool
	cmdChan   chan ClientCommand
}

const basePlaybackInterval = time.Second * 1

func findStartIndex(events []Event) int {
	for i, e := range events {
		if e.Type == "Pass" {
			return i
		}
	}
	return 0
}

func NewHub(events []Event) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		events:     events,
		cursor:     findStartIndex(events),
		isPlaying:  false,
		filters:    nil,
		cmdChan:    make(chan ClientCommand, 100),
	}
}

func (h *Hub) eventEnabled(event Event) bool {
	return h.filters == nil || h.filters[event.Type]
}

func (h *Hub) Run() {
	ticker := time.NewTicker(basePlaybackInterval)
	defer ticker.Stop()

	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			info, err := json.Marshal(MatchInfo{
				Type:  "MATCH_INFO",
				Teams: buildMatchTeams(h.events),
			})
			if err == nil {
				client.send <- info
			}
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		case cmd := <-h.cmdChan:
			switch cmd.Action {
			case "START":
				log.Println("Received START command")
				h.isPlaying = true
			case "PAUSE":
				log.Println("Received PAUSE command")
				h.isPlaying = false
			case "RESET":
				log.Println("Received RESET command")
				h.cursor = 0
				h.cursor = findStartIndex(h.events)
				h.isPlaying = false
			case "SPEED":
				if cmd.Speed <= 0 {
					continue
				}
				interval := time.Duration(float64(basePlaybackInterval) / cmd.Speed)
				if interval < 50*time.Millisecond {
					interval = 50 * time.Millisecond
				}
				ticker.Stop()
				ticker = time.NewTicker(interval)
				log.Printf("Playback speed set to %.2fx (%s interval)", cmd.Speed, interval)
			case "FILTER":
				h.filters = make(map[EventType]bool, len(cmd.EventTypes))
				for _, eventType := range cmd.EventTypes {
					h.filters[eventType] = true
				}
			}
		case <-ticker.C:
			if !h.isPlaying || len(h.events) == 0 {
				continue
			}

			for h.cursor < len(h.events) && !h.eventEnabled(h.events[h.cursor]) {
				h.cursor++
			}

			if h.cursor >= len(h.events) {
				h.isPlaying = false
				continue
			}

			frame := StreamFrame{
				Type:  "TICK",
				Data:  h.events[h.cursor],
				Index: h.cursor + 1,
				Total: len(h.events),
			}

			payload, err := json.Marshal(frame)
			if err == nil {
				go func(p []byte) { h.broadcast <- p }(payload)
			}

			h.cursor++
		}
	}
}

func buildMatchTeams(events []Event) []MatchTeam {
	teamIndex := make(map[string]int)
	teams := make([]MatchTeam, 0, 2)

	for _, event := range events {
		if event.Team == "" || len(event.Lineup) == 0 {
			continue
		}
		index, ok := teamIndex[event.Team]
		if !ok {
			index = len(teams)
			teamIndex[event.Team] = index
			teams = append(teams, MatchTeam{
				Name:      event.Team,
				Formation: event.Formation,
				Players:   event.Lineup,
			})
		}
	}
	return teams
}
