import React, { useState, useEffect, useCallback } from 'react';
import { Card, List, Tag, Typography, Space, Badge, Tooltip, Empty, Button } from 'antd';
import {
  EnvironmentOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  ArrowDownOutlined
} from '@ant-design/icons';
import { databaseAPI } from '../api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Title } = Typography;

const LatestEarthquakes = ({ 
  limit = 10, 
  autoRefresh = true, 
  refreshInterval = 30000,
  showHeader = true,
  compact = false 
}) => {
  const [earthquakes, setEarthquakes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchLatestEarthquakes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await databaseAPI.getLatest(limit);
      const data = response.data?.earthquakes || response.data || [];
      setEarthquakes(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch latest earthquakes:', error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchLatestEarthquakes();

    if (autoRefresh) {
      const interval = setInterval(fetchLatestEarthquakes, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchLatestEarthquakes, autoRefresh, refreshInterval]);

  // Get magnitude color and severity
  const getMagnitudeInfo = (mag) => {
    if (mag >= 7) return { color: '#ff4d4f', label: 'Major', bgColor: '#fff1f0' };
    if (mag >= 5) return { color: '#fa8c16', label: 'Moderate', bgColor: '#fff7e6' };
    if (mag >= 3) return { color: '#fadb14', label: 'Minor', bgColor: '#fffbe6' };
    return { color: '#52c41a', label: 'Light', bgColor: '#f6ffed' };
  };

  // Get depth category
  const getDepthCategory = (depth) => {
    if (depth < 70) return { label: 'Shallow', color: '#ff7a45' };
    if (depth < 300) return { label: 'Intermediate', color: '#ffa940' };
    return { label: 'Deep', color: '#36cfc9' };
  };

  const renderItem = (item, index) => {
    const magInfo = getMagnitudeInfo(item.magnitude);
    const depthInfo = getDepthCategory(item.depth);
    const isRecent = dayjs().diff(dayjs(item.time), 'hour') < 1;

    return (
      <List.Item
        style={{
          padding: compact ? '8px 12px' : '12px 16px',
          background: index === 0 ? magInfo.bgColor : 'white',
          borderLeft: `4px solid ${magInfo.color}`,
          marginBottom: 8,
          borderRadius: 8,
          transition: 'all 0.3s'
        }}
      >
        <List.Item.Meta
          avatar={
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              minWidth: 60
            }}>
              <Badge 
                count={isRecent ? 'NEW' : 0} 
                offset={[10, 0]}
                style={{ backgroundColor: '#52c41a' }}
              >
                <div style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${magInfo.color} 0%, ${magInfo.color}99 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: 16,
                  boxShadow: `0 4px 12px ${magInfo.color}40`
                }}>
                  {item.magnitude?.toFixed(1)}
                </div>
              </Badge>
              <Text style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                {magInfo.label}
              </Text>
            </div>
          }
          title={
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <Space wrap>
                <EnvironmentOutlined style={{ color: '#1890ff' }} />
                <Text strong ellipsis={{ tooltip: true }} style={{ maxWidth: 300 }}>
                  {item.place || 'Unknown Location'}
                </Text>
              </Space>
              <Space size="small" wrap>
                <Tooltip title="Depth">
                  <Tag color={depthInfo.color} icon={<ArrowDownOutlined />}>
                    {item.depth?.toFixed(1)} km ({depthInfo.label})
                  </Tag>
                </Tooltip>
                <Tooltip title={dayjs(item.time).format('YYYY-MM-DD HH:mm:ss UTC')}>
                  <Tag icon={<ClockCircleOutlined />}>
                    {dayjs(item.time).fromNow()}
                  </Tag>
                </Tooltip>
              </Space>
            </Space>
          }
          description={
            !compact && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Lat: {item.latitude?.toFixed(4)}°, Lon: {item.longitude?.toFixed(4)}°
              </Text>
            )
          }
        />
      </List.Item>
    );
  };

  return (
    <Card
      title={showHeader ? (
        <Space>
          <ThunderboltOutlined style={{ color: '#fa8c16' }} />
          <span>Latest Earthquakes</span>
          {lastUpdate && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {dayjs(lastUpdate).format('HH:mm:ss')}
            </Tag>
          )}
        </Space>
      ) : null}
      extra={showHeader ? (
        <Button 
          type="text" 
          icon={<ReloadOutlined spin={loading} />} 
          onClick={fetchLatestEarthquakes}
          loading={loading}
        >
          Refresh
        </Button>
      ) : null}
      bodyStyle={{ padding: compact ? 8 : 16 }}
      loading={loading && earthquakes.length === 0}
    >
      {earthquakes.length > 0 ? (
        <List
          itemLayout="horizontal"
          dataSource={earthquakes}
          renderItem={renderItem}
          style={{ maxHeight: 500, overflowY: 'auto' }}
        />
      ) : (
        <Empty description="No earthquake data available" />
      )}
    </Card>
  );
};

export default LatestEarthquakes;
