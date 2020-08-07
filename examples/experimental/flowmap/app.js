import React from 'react';
import {render} from 'react-dom';
import DeckGL from 'deck.gl';
import {scaleSqrt} from 'd3-scale';

import FlowMapLayer from '@flowmap.gl/core';
import ClusteredFlowMapLayer from './clustered-flowmap-layer';

import counties from './counties.geo.json';
import flows from './flows.json';

const INITIAL_VIEW_STATE = {
  latitude: 40,
  longitude: -100,
  zoom: 4
};

const COLOR_SCALE = scaleSqrt()
  .domain([0, 1600, 4900])
  .range(['#edf8b1', '#7fcdbb', '#2c7fb8']);

function getTooltip({object}) {
  if (!object) {
    return null;
  }
  // flow.count is from the user flow data
  // flow.magnitude is from clustered flow data
  return object.properties ? object.properties.name : String(object.count || object.magnitude);
}

function Root({clustered = true}) {
  const layer = new (clustered ? ClusteredFlowMapLayer : FlowMapLayer)({
    locations: counties,
    flows,
    getFlowMagnitude: flow => flow.count || 0,
    getFlowOriginId: flow => flow.origin,
    getFlowDestId: flow => flow.dest,
    getLocationId: location => location.properties.id,
    getLocationCentroid: location => location.properties.centroid,
    getFlowColor: flow => COLOR_SCALE(flow.count || flow.magnitude || 0),
    showOnlyTopFlows: 3000,
    showTotals: true,
    showLocationAreas: false,
    pickable: true,
    autoHighlight: true,

    /* styling options */
    colors: {
      flows: {
        scheme: ['#edf8b1', '#7fcdbb', '#2c7fb8'], // ignored if getFlowColor is supplied
        highlighted: '#FD0'
      },
      locationCircles: {
        inner: '#DDD',
        outgoing: '#80f',
        incoming: '#08f',
        highlighted: '#FD0'
      }
    },
    maxFlowThickness: 16,
    maxLocationCircleSize: 20,
    outlineThickness: 1,
    // flowMagnitudeExtent: [0, 100],
    // locationTotalsExtent: [0, 200],

    /* clustering options */
    clusterRadius: 40,
    maxZoom: 8

    /* animation options */
    // animate: true,
    // animationCurrentTime: 0,
    // animationTailLength: 0.7,

    /* custom highlight */
    // highlightedLocationId: <string>,
    // highlightedLocationAreaId: <string>,
    // highlightedFlow: <Flow>,
  });

  return (
    <DeckGL
      controller={true}
      initialViewState={INITIAL_VIEW_STATE}
      layers={[layer]}
      getTooltip={getTooltip}
    />
  );
}

/* global document */
render(<Root />, document.body.appendChild(document.createElement('div')));
