'use-strict'

// base libs
import PropTypes from 'prop-types'
// Import PureComponent for actual usage and alias an unused copy to avoid
// eslint unused-var warnings during tree-shaking in bundlers
import React, { PureComponent, PureComponent as __PureComponent } from 'react'
import {
  Platform,
  Dimensions,
  LayoutAnimation
} from 'react-native'
// map-related libs
import MapView from 'react-native-maps'
import SuperCluster from 'supercluster'
import GeoViewport from '@mapbox/geo-viewport'
// components / views
import ClusterMarker from 'react-native-maps-super-cluster/ClusterMarker'
// libs / utils
import {
  regionToBoundingBox,
  itemToGeoJSONFeature,
  getCoordinatesFromItem,
} from 'react-native-maps-super-cluster/util'

export default class FixedClusteredMapView extends PureComponent {

  constructor(_props) {
    super(_props)

    this.state = {
      data: [], // helds renderable clusters and markers
      region: _props.region || _props.initialRegion, // helds current map region
    }

    this.isAndroid = Platform.OS === 'android'
    this.dimensions = [_props.width, _props.height]

    this.mapRef = this.mapRef.bind(this)
    this.onClusterPress = this.onClusterPress.bind(this)
    this.onRegionChangeComplete = this.onRegionChangeComplete.bind(this)
  }

  componentDidMount() {
    this.clusterize(this.props.data)
  }

  // Updated to UNSAFE_ prefix to address deprecation warning
  UNSAFE_componentWillReceiveProps(_nextProps) {
    if (this.props.data !== _nextProps.data)
      this.clusterize(_nextProps.data)
  }

  // Updated to UNSAFE_ prefix to address deprecation warning
  UNSAFE_componentWillUpdate(_nextProps, _nextState) {
    if (
      !this.isAndroid &&
      this.props.animateClusters &&
      this.clustersChanged(_nextState)
    )
      LayoutAnimation.configureNext(this.props.layoutAnimationConf)
  }

  mapRef(_ref) {
    this.mapview = _ref
  }

  getMapRef() {
    return this.mapview
  }

  getClusteringEngine() {
    return this.index
  }

  clusterize(_dataset) {
    this.index = new SuperCluster({  
      extent: this.props.extent,
      minZoom: this.props.minZoom,
      maxZoom: this.props.maxZoom,
      radius: this.props.radius || (this.dimensions[0] * .045), // 4.5% of screen width
    })

    // get formatted GeoPoints for cluster
    const _rawData = _dataset.map(item =>
      itemToGeoJSONFeature(item, this.props.accessor)
    )

    // load geopoints into SuperCluster
    this.index.load(_rawData)

    const _data = this.getClusters(this.state.region)
    this.setState({ data: _data })
  }

  clustersChanged(_nextState) {
    return this.state.data.length !== _nextState.data.length
  }

  onRegionChangeComplete(_region) {
    let _data = this.getClusters(_region)
    this.setState({ region: _region, data: _data }, () => {
        this.props.onRegionChangeComplete && this.props.onRegionChangeComplete(_region, _data)
    })
  }

  getClusters(_region) {
    const _bbox = regionToBoundingBox(_region),
          viewport = (_region.longitudeDelta) >= 40
            ? { zoom: this.props.minZoom }
            : GeoViewport.viewport(_bbox, this.dimensions)

    return this.index.getClusters(_bbox, viewport.zoom)
  }

  onClusterPress(_cluster) {

    // cluster press behavior might be extremely custom.
    if (!this.props.preserveClusterPressBehavior) {
      this.props.onClusterPress && this.props.onClusterPress(_cluster.properties.cluster_id)
      return
    }

    // //////////////////////////////////////////////////////////////////////////////////
    // NEW IMPLEMENTATION (with fitToCoordinates)
    // //////////////////////////////////////////////////////////////////////////////////
    // get cluster children
    const _children = this.index.getLeaves(_cluster.properties.cluster_id, this.props.clusterPressMaxChildren)
    const _markers = _children.map(c => c.properties.item)

    const _coordinates = _markers.map(_item => getCoordinatesFromItem(_item, this.props.accessor, false))

    this.mapview.fitToCoordinates(_coordinates, { edgePadding: this.props.edgePadding })
    this.props.onClusterPress && this.props.onClusterPress(_cluster.properties.cluster_id, _markers)
  }

  render() {
    const { style: _style, ...props } = this.props

    return (
      <MapView
        {...props}
        style={_style}
        ref={this.mapRef}
        onRegionChangeComplete={this.onRegionChangeComplete}>
        {
          this.props.clusteringEnabled && this.state.data.map((d) => {
            if (d.properties.point_count === 0)
              return this.props.renderMarker(d.properties.item)

            return (
              <ClusterMarker
                {...d}
                onPress={this.onClusterPress}
                renderCluster={this.props.renderCluster}
                key={`cluster-${d.properties.cluster_id}`} />
            )
          })
        }
        {
          !this.props.clusteringEnabled && this.props.data.map(d => this.props.renderMarker(d))
        }
        {this.props.children}
      </MapView>
    )
  }
}

FixedClusteredMapView.defaultProps = {
  minZoom: 1,
  maxZoom: 16,
  extent: 512,
  accessor: 'location',
  animateClusters: true,
  clusteringEnabled: true,
  clusterPressMaxChildren: 100,
  preserveClusterPressBehavior: true,
  width: Dimensions.get('window').width,
  height: Dimensions.get('window').height,
  layoutAnimationConf: LayoutAnimation.Presets.spring,
  edgePadding: { top: 10, left: 10, right: 10, bottom: 10 }
}

FixedClusteredMapView.propTypes = {
  ...MapView.propTypes,
  // number
  radius: PropTypes.number,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  extent: PropTypes.number.isRequired,
  minZoom: PropTypes.number.isRequired,
  maxZoom: PropTypes.number.isRequired,
  clusterPressMaxChildren: PropTypes.number.isRequired,
  // array
  data: PropTypes.array.isRequired,
  // func
  onExplode: PropTypes.func,
  onImplode: PropTypes.func,
  onClusterPress: PropTypes.func,
  renderMarker: PropTypes.func.isRequired,
  renderCluster: PropTypes.func.isRequired,
  // bool
  animateClusters: PropTypes.bool.isRequired,
  clusteringEnabled: PropTypes.bool.isRequired,
  preserveClusterPressBehavior: PropTypes.bool.isRequired,
  // object
  layoutAnimationConf: PropTypes.object,
  edgePadding: PropTypes.object.isRequired,
  // string
  // mutiple
  accessor: PropTypes.oneOfType([PropTypes.string, PropTypes.func])
}
