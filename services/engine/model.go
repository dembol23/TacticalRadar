package main

import (
	"encoding/json"
)

type EventType string

const (
	EventTypePass EventType = "Pass"
	EventTypeShot EventType = "Shot"
)

type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

func (p *Point) UnmarshalJSON(data []byte) error {
	var coords [2]float64
	if err := json.Unmarshal(data, &coords); err != nil {
		return err
	}
	p.X = coords[0]
	p.Y = coords[1]
	return nil
}

func (p Point) MarshalJSON() ([]byte, error) {
	return json.Marshal([2]float64{p.X, p.Y})
}

type Event struct {
	ID            string    `json:"id"`
	Minute        int64     `json:"minute"`
	Second        int64     `json:"second"`
	Type          EventType `json:"type"`
	Team          string    `json:"team"`
	Player        string    `json:"player"`
	StartLocation Point     `json:"startLocation"`
	EndLocation   Point     `json:"endLocation"`
}

func (e *Event) UnmarshalJSON(data []byte) error {
	var wire struct {
		ID            string    `json:"id"`
		Minute        int64     `json:"minute"`
		Second        int64     `json:"second"`
		Type          EventType `json:"type"`
		Team          string    `json:"team"`
		Player        string    `json:"player"`
		StartLocation Point     `json:"location"`
		EndLocation   Point     `json:"end_location"`
	}
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}

	*e = Event{
		ID:            wire.ID,
		Minute:        wire.Minute,
		Second:        wire.Second,
		Type:          wire.Type,
		Team:          wire.Team,
		Player:        wire.Player,
		StartLocation: wire.StartLocation,
		EndLocation:   wire.EndLocation,
	}
	return nil
}

type ClientCommand struct {
	Action string `json:"action"`
}

type StreamFrame struct {
	Type  string `json:"type"`
	Data  any    `json:"data"`
	Index int    `json:"index"`
	Total int    `json:"total"`
}
