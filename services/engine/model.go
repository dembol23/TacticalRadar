package main

import (
	"encoding/json"
)

type EventType string

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
	StartLocation *Point    `json:"startLocation,omitempty"`
	EndLocation   *Point    `json:"endLocation,omitempty"`
}

func (e *Event) UnmarshalJSON(data []byte) error {
	var wire struct {
		ID            string          `json:"id"`
		Minute        int64           `json:"minute"`
		Second        int64           `json:"second"`
		Type          json.RawMessage `json:"type"`
		Team          json.RawMessage `json:"team"`
		Player        json.RawMessage `json:"player"`
		Location      *Point          `json:"location"`
		StartLocation *Point          `json:"startLocation"`
		EndLocation   *Point          `json:"endLocation"`
		Pass          *struct {
			EndLocation *Point `json:"end_location"`
		} `json:"pass"`
		Carry *struct {
			EndLocation *Point `json:"end_location"`
		} `json:"carry"`
		Shot *struct {
			EndLocation *Point `json:"end_location"`
		} `json:"shot"`
	}
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}

	typeName, err := jsonValueName(wire.Type)
	if err != nil {
		return err
	}
	teamName, err := jsonValueName(wire.Team)
	if err != nil {
		return err
	}
	playerName, err := jsonValueName(wire.Player)
	if err != nil {
		return err
	}

	startLocation := wire.StartLocation
	if startLocation == nil {
		startLocation = wire.Location
	}
	endLocation := wire.EndLocation
	if endLocation == nil && wire.Pass != nil {
		endLocation = wire.Pass.EndLocation
	}
	if endLocation == nil && wire.Carry != nil {
		endLocation = wire.Carry.EndLocation
	}
	if endLocation == nil && wire.Shot != nil {
		endLocation = wire.Shot.EndLocation
	}

	*e = Event{
		ID:            wire.ID,
		Minute:        wire.Minute,
		Second:        wire.Second,
		Type:          EventType(typeName),
		Team:          teamName,
		Player:        playerName,
		StartLocation: startLocation,
		EndLocation:   endLocation,
	}
	return nil
}

func jsonValueName(data json.RawMessage) (string, error) {
	if len(data) == 0 || string(data) == "null" {
		return "", nil
	}

	var name string
	if err := json.Unmarshal(data, &name); err == nil {
		return name, nil
	}

	var value struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(data, &value); err != nil {
		return "", err
	}
	return value.Name, nil
}

type ClientCommand struct {
	Action string  `json:"action"`
	Speed  float64 `json:"speed,omitempty"`
}

type StreamFrame struct {
	Type  string `json:"type"`
	Data  any    `json:"data"`
	Index int    `json:"index"`
	Total int    `json:"total"`
}
