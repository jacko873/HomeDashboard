package sonos

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// Sonos players expose UPnP services over SOAP on port 1400. Each helper
// below wraps one action; responses are matched by local element name, so
// namespace prefixes don't matter.

const (
	avTransportEndpoint      = "/MediaRenderer/AVTransport/Control"
	avTransportService       = "urn:schemas-upnp-org:service:AVTransport:1"
	renderingEndpoint        = "/MediaRenderer/RenderingControl/Control"
	renderingService         = "urn:schemas-upnp-org:service:RenderingControl:1"
	contentDirectoryEndpoint = "/MediaServer/ContentDirectory/Control"
	contentDirectoryService  = "urn:schemas-upnp-org:service:ContentDirectory:1"
	topologyEndpoint         = "/ZoneGroupTopology/Control"
	topologyService          = "urn:schemas-upnp-org:service:ZoneGroupTopology:1"
)

const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body><u:%s xmlns:u="%s">%s</u:%s></s:Body>
</s:Envelope>`

// soap performs one UPnP action against host and unmarshals the response
// envelope into out (use `xml:"Body>XxxResponse>Field"` paths).
func (c *Client) soap(ctx context.Context, host, endpoint, service, action, args string, out any) error {
	body := fmt.Sprintf(soapEnvelope, action, service, args, action)
	url := fmt.Sprintf("http://%s:1400%s", host, endpoint)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", `text/xml; charset="utf-8"`)
	req.Header.Set("SOAPACTION", fmt.Sprintf("%q", service+"#"+action))

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("sonos %s: %w", action, err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return fmt.Errorf("sonos %s: %w", action, err)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("sonos %s: HTTP %d", action, resp.StatusCode)
	}
	if err := xml.Unmarshal(data, out); err != nil {
		return fmt.Errorf("sonos %s: parsing response: %w", action, err)
	}
	return nil
}

func (c *Client) transportState(ctx context.Context, host string) (string, error) {
	var resp struct {
		State string `xml:"Body>GetTransportInfoResponse>CurrentTransportState"`
	}
	err := c.soap(ctx, host, avTransportEndpoint, avTransportService, "GetTransportInfo",
		"<InstanceID>0</InstanceID>", &resp)
	return resp.State, err
}

type positionInfo struct {
	Track    int    `xml:"Body>GetPositionInfoResponse>Track"`
	Duration string `xml:"Body>GetPositionInfoResponse>TrackDuration"`
	Metadata string `xml:"Body>GetPositionInfoResponse>TrackMetaData"`
	URI      string `xml:"Body>GetPositionInfoResponse>TrackURI"`
	RelTime  string `xml:"Body>GetPositionInfoResponse>RelTime"`
}

func (c *Client) positionInfo(ctx context.Context, host string) (positionInfo, error) {
	var resp positionInfo
	err := c.soap(ctx, host, avTransportEndpoint, avTransportService, "GetPositionInfo",
		"<InstanceID>0</InstanceID>", &resp)
	return resp, err
}

func (c *Client) volume(ctx context.Context, host string) (int, error) {
	var resp struct {
		Volume int `xml:"Body>GetVolumeResponse>CurrentVolume"`
	}
	err := c.soap(ctx, host, renderingEndpoint, renderingService, "GetVolume",
		"<InstanceID>0</InstanceID><Channel>Master</Channel>", &resp)
	return resp.Volume, err
}

func (c *Client) muted(ctx context.Context, host string) (bool, error) {
	var resp struct {
		Mute int `xml:"Body>GetMuteResponse>CurrentMute"`
	}
	err := c.soap(ctx, host, renderingEndpoint, renderingService, "GetMute",
		"<InstanceID>0</InstanceID><Channel>Master</Channel>", &resp)
	return resp.Mute == 1, err
}

// browseQueue returns DIDL-Lite for a slice of the play queue (Q:0).
func (c *Client) browseQueue(ctx context.Context, host string, start, count int) (string, error) {
	var resp struct {
		Result string `xml:"Body>BrowseResponse>Result"`
	}
	args := fmt.Sprintf(
		"<ObjectID>Q:0</ObjectID><BrowseFlag>BrowseDirectChildren</BrowseFlag><Filter>*</Filter>"+
			"<StartingIndex>%d</StartingIndex><RequestedCount>%d</RequestedCount><SortCriteria></SortCriteria>",
		start, count)
	err := c.soap(ctx, host, contentDirectoryEndpoint, contentDirectoryService, "Browse", args, &resp)
	return resp.Result, err
}

func (c *Client) zoneGroupState(ctx context.Context, host string) (string, error) {
	var resp struct {
		State string `xml:"Body>GetZoneGroupStateResponse>ZoneGroupState"`
	}
	err := c.soap(ctx, host, topologyEndpoint, topologyService, "GetZoneGroupState", "", &resp)
	return resp.State, err
}
