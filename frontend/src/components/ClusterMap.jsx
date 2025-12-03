import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { clusteringAPI } from '../api';
import { message, Spin, Select } from 'antd';
import 'leaflet/dist/leaflet.css';

const { Option } = Select;

const ClusterMap = ({ dateRange, height = 500 }) => {
  const [clusters, setClusters] = useState([]);
  const [dataPoints, setDataPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [algorithm, setAlgorithm] = useState('dbscan');
  const [nClusters, setNClusters] = useState(5);

  useEffect(() => {
    fetchData();
  }, [dateRange, algorithm, nClusters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {
        algorithm,
        n_clusters: nClusters,
        eps: 5.0
      };

      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }

      const response = await clusteringAPI.getGeographicClusters(params);
      setClusters(response.data.clusters || []);
      setDataPoints(response.data.data_points || []);
    } catch (error) {
      message.error('Failed to fetch cluster data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center" style={{ height }}><Spin size="large" /></div>;
  }

  const getClusterColor = (clusterId) => {
    const colors = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe'];
    return clusterId === -1 ? '#808080' : colors[clusterId % colors.length];
  };

  const getMarkerSize = (magnitude) => {
    return magnitude ? Math.max(3, magnitude * 2) : 5;
  };

  return (
    <div>
      <div className="mb-4 flex gap-4 items-center">
        <Select value={algorithm} onChange={setAlgorithm} style={{ width: 150 }}>
          <Option value="dbscan">DBSCAN</Option>
          <Option value="kmeans">K-Means</Option>
        </Select>

        {algorithm === 'kmeans' && (
          <Select value={nClusters} onChange={setNClusters} style={{ width: 150 }}>
            {[3, 4, 5, 6, 7, 8].map(n => (
              <Option key={n} value={n}>{n} Clusters</Option>
            ))}
          </Select>
        )}

        <div className="text-sm text-gray-600">
          {clusters.length} clusters found, {dataPoints.length} data points
        </div>
      </div>

      <div style={{ height: height }} className="rounded-lg overflow-hidden border border-gray-300">
        <MapContainer
          center={[0, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {dataPoints.map((point, idx) => (
            <CircleMarker
              key={`${point.id}-${idx}`}
              center={[point.latitude, point.longitude]}
              radius={getMarkerSize(point.magnitude)}
              fillColor={getClusterColor(point.cluster)}
              color="#fff"
              weight={1}
              opacity={0.8}
              fillOpacity={0.6}
            >
              <Popup>
                <div className="text-sm">
                  <p><strong>ID:</strong> {point.id}</p>
                  <p><strong>Magnitude:</strong> {point.magnitude?.toFixed(2)}</p>
                  <p><strong>Depth:</strong> {point.depth?.toFixed(2)} km</p>
                  <p><strong>Cluster:</strong> {point.cluster === -1 ? 'Noise' : point.cluster}</p>
                  {point.time && <p><strong>Time:</strong> {new Date(point.time).toLocaleString()}</p>}
                </div>
              </Popup>
              <Tooltip>
                Magnitude: {point.magnitude?.toFixed(1)}
              </Tooltip>
            </CircleMarker>
          ))}

          {clusters.map((cluster) => (
            <CircleMarker
              key={`centroid-${cluster.cluster_id}`}
              center={[cluster.centroid.latitude, cluster.centroid.longitude]}
              radius={10}
              fillColor={getClusterColor(cluster.cluster_id)}
              color="#000"
              weight={2}
              opacity={1}
              fillOpacity={0.9}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">Cluster {cluster.cluster_id} Centroid</p>
                  <p><strong>Size:</strong> {cluster.size} earthquakes</p>
                  <p><strong>Avg Magnitude:</strong> {cluster.avg_magnitude?.toFixed(2)}</p>
                  <p><strong>Max Magnitude:</strong> {cluster.max_magnitude?.toFixed(2)}</p>
                  <p><strong>Avg Depth:</strong> {cluster.avg_depth?.toFixed(2)} km</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {clusters.slice(0, 4).map(cluster => (
          <div
            key={cluster.cluster_id}
            className="p-3 rounded border-l-4"
            style={{ borderColor: getClusterColor(cluster.cluster_id) }}
          >
            <div className="text-sm font-semibold">Cluster {cluster.cluster_id}</div>
            <div className="text-xs text-gray-600">{cluster.size} earthquakes</div>
            <div className="text-xs">Avg Mag: {cluster.avg_magnitude?.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClusterMap;
