// Re-export both the component and the handle interface so that
// downstream modules can use the ref type without importing the
// heavier MapShowCluster implementation file directly.
import MapShowCluster, { MapShowClusterHandle } from './MapShowCluster';

export type { MapShowClusterHandle };
export default MapShowCluster;
