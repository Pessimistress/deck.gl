import {CompositeLayer} from '@deck.gl/core';
import FlowMapLayer from '@flowmap.gl/core';

import Supercluster from 'supercluster';

const defaultProps = {
  ...FlowMapLayer.defaultProps,

  // Supercluster options
  // https://www.npmjs.com/package/supercluster
  clusterRadius: 40,
  minZoom: 0,
  maxZoom: 16
};

function getLocationCentroids({locations, getLocationId, getLocationCentroid}) {
  if (locations.type === 'FeatureCollection' && locations.features) {
    // is geojson
    locations = locations.features;
  }
  return locations.map(loc => ({
    properties: {
      id: getLocationId(loc)
    },
    geometry: {
      coordinates: getLocationCentroid(loc)
    }
  }));
}

function getCluster(
  locationIndex,
  {maxZoom, flows, getFlowMagnitude, getFlowOriginId, getFlowDestId},
  z,
  cache
) {
  if (!locationIndex || !flows || z > maxZoom) {
    return null;
  }
  if (cache[z]) {
    return cache[z];
  }
  const clusters = locationIndex.getClusters([-180, -85, 180, 85], z);
  const locationIdToClusterId = {};

  for (const cluster of clusters) {
    if (cluster.properties.cluster) {
      // Is a cluster created by spatial index
      const clusterId = cluster.properties.cluster_id;
      // Avoid conflict with the original location ids
      const uniqueId = `_sc_${clusterId}`;
      cluster.properties.id = uniqueId;
      const children = locationIndex.getLeaves(clusterId, Infinity);
      for (const loc of children) {
        locationIdToClusterId[loc.properties.id] = uniqueId;
      }
    } else {
      // Not a cluster
      locationIdToClusterId[cluster.properties.id] = cluster.properties.id;
    }
  }

  const uniqueFlows = {};
  for (const flow of flows) {
    const magnitude = getFlowMagnitude(flow);
    let originId = getFlowOriginId(flow);
    let destId = getFlowDestId(flow);
    if (originId in locationIdToClusterId && destId in locationIdToClusterId) {
      originId = locationIdToClusterId[originId];
      destId = locationIdToClusterId[destId];
      const key = `${originId}---${destId}`;
      uniqueFlows[key] = uniqueFlows[key] || {originId, destId, magnitude: 0};
      uniqueFlows[key].magnitude += magnitude;
    }
  }

  cache[z] = {
    locations: clusters,
    flows: Object.values(uniqueFlows)
  };
  return cache[z];
}

export default class ClusteredFlowMapLayer extends CompositeLayer {
  shouldUpdateState(params) {
    const {viewport} = this.context;
    const {z} = this.state;
    const clusterZ = Math.round(viewport.zoom);
    if (z !== clusterZ) {
      return true;
    }
    return super.shouldUpdateState(params);
  }

  updateState({oldProps, props, changeFlags}) {
    let clustersChanged = false;

    if (
      props.locations &&
      (props.locations !== oldProps.locations ||
        (changeFlags.updateTriggersChanged &&
          changeFlags.updateTriggersChanged.getLocationCentroid))
    ) {
      const locationIndex = new Supercluster({
        radius: props.clusterRadius,
        minZoom: props.minZoom,
        maxZoom: props.maxZoom
      });
      locationIndex.load(getLocationCentroids(props));
      this.setState({
        locationIndex,
        clustersCache: []
      });
      clustersChanged = true;
    } else if (
      props.flows &&
      (props.flows !== oldProps.flows ||
        (changeFlags.updateTriggersChanged && changeFlags.updateTriggersChanged.getFlowMagnitude))
    ) {
      this.setState({
        clustersCache: []
      });
      clustersChanged = true;
    }

    const {viewport} = this.context;
    const clusterZ = Math.round(viewport.zoom);
    if (clustersChanged || this.state.z !== clusterZ) {
      this.setState(
        getCluster(this.state.locationIndex, props, clusterZ, this.state.clustersCache)
      );
    }
    this.setState({z: clusterZ});
  }

  renderLayers() {
    const {z} = this.state;
    const {maxZoom} = this.props;

    if (z > maxZoom) {
      return new FlowMapLayer(
        this.getSubLayerProps({
          ...this.props,
          id: 'flowmap'
        })
      );
    }
    return new FlowMapLayer(
      this.getSubLayerProps({
        ...this.props,
        id: 'flowmap',
        locations: this.state.locations,
        flows: this.state.flows,
        getLocationId: f => f.properties.id,
        getLocationCentroid: f => f.geometry.coordinates,
        getFlowOriginId: d => d.originId,
        getFlowDestId: d => d.destId,
        getFlowMagnitude: d => d.magnitude
      })
    );
  }
}

ClusteredFlowMapLayer.layerName = 'ClusteredFlowMapLayer';
ClusteredFlowMapLayer.defaultProps = defaultProps;
