import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Tag, Badge, Typography, Space, Tooltip, Progress, Button } from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  WifiOutlined,
  DatabaseOutlined,
  CloudSyncOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { databaseAPI } from '../api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Title } = Typography;

const RealtimeStatus = ({ autoRefresh = true, refreshInterval = 60000, onDataUpdate }) => {
  const [status, setStatus] = useState({
    isConnected: false,
    lastUpdate: null,
    latestEarthquake: null,
    totalToday: 0,
    isRefreshing: false,
    nextRefresh: refreshInterval / 1000,
    error: null
  });

  const [countdown, setCountdown] = useState(refreshInterval / 1000);

  // Fetch latest data
  const fetchLatestData = useCallback(async () => {
    setStatus(prev => ({ ...prev, isRefreshing: true, error: null }));
    
    try {
      // Get latest earthquake
      const today = dayjs().format('YYYY-MM-DD');
      const response = await databaseAPI.getEarthquakes({
        start_date: today,
        end_date: today,
        limit: 1,
        sort_by: 'time',
        sort_order: 'desc'
      });

      // Get today's stats
      const statsResponse = await databaseAPI.getStats({
        start_date: today,
        end_date: today
      });

      const latestQuake = response.data?.earthquakes?.[0] || response.data?.[0] || null;
      
      setStatus(prev => ({
        ...prev,
        isConnected: true,
        lastUpdate: new Date(),
        latestEarthquake: latestQuake,
        totalToday: statsResponse.data?.total_count || 0,
        isRefreshing: false
      }));

      setCountdown(refreshInterval / 1000);
      
      // Callback for parent component
      if (onDataUpdate) {
        onDataUpdate({
          latestEarthquake: latestQuake,
          totalToday: statsResponse.data?.total_count || 0,
          lastUpdate: new Date()
        });
      }
    } catch (error) {
      console.error('Failed to fetch latest data:', error);
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        isRefreshing: false,
        error: error.message
      }));
    }
  }, [refreshInterval, onDataUpdate]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchLatestData();

    if (autoRefresh) {
      const interval = setInterval(fetchLatestData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchLatestData, autoRefresh, refreshInterval]);

  // Countdown timer
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return refreshInterval / 1000;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval]);

  // Format relative time
  const getRelativeTime = (date) => {
    if (!date) return 'Never';
    return dayjs(date).fromNow();
  };

  // Get magnitude color
  const getMagnitudeColor = (mag) => {
    if (!mag) return '#999';
    if (mag >= 7) return '#ff4d4f';
    if (mag >= 5) return '#fa8c16';
    if (mag >= 3) return '#fadb14';
    return '#52c41a';
  };

  // Get magnitude label
  const getMagnitudeLabel = (mag) => {
    if (!mag) return 'N/A';
    if (mag >= 7) return 'Major';
    if (mag >= 5) return 'Moderate';
    if (mag >= 3) return 'Minor';
    return 'Light';
  };

  const { isConnected, lastUpdate, latestEarthquake, totalToday, isRefreshing, error } = status;

  return (
    <Card 
      className="realtime-status-card"
      style={{ 
        marginBottom: 16,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: 'none',
        borderRadius: 12
      }}
      bodyStyle={{ padding: '16px 20px' }}
    >
      <Row gutter={[24, 16]} align="middle">
        {/* Connection Status */}
        <Col xs={24} sm={8} md={6} lg={4}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
              <WifiOutlined style={{ marginRight: 6 }} />
              STATUS
            </Text>
            <Badge 
              status={isConnected ? "success" : "error"} 
              text={
                <Text strong style={{ color: '#fff', fontSize: 14 }}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Text>
              }
            />
          </Space>
        </Col>

        {/* Last Update Time */}
        <Col xs={24} sm={8} md={6} lg={4}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
              <ClockCircleOutlined style={{ marginRight: 6 }} />
              LAST UPDATE
            </Text>
            <Tooltip title={lastUpdate ? dayjs(lastUpdate).format('YYYY-MM-DD HH:mm:ss') : 'Never'}>
              <Text strong style={{ color: '#fff', fontSize: 14 }}>
                {getRelativeTime(lastUpdate)}
              </Text>
            </Tooltip>
          </Space>
        </Col>

        {/* Today's Count */}
        <Col xs={24} sm={8} md={6} lg={4}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
              <DatabaseOutlined style={{ marginRight: 6 }} />
              TODAY'S EARTHQUAKES
            </Text>
            <Text strong style={{ color: '#fff', fontSize: 18 }}>
              {totalToday}
            </Text>
          </Space>
        </Col>

        {/* Latest Earthquake */}
        <Col xs={24} sm={16} md={12} lg={8}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
              <ThunderboltOutlined style={{ marginRight: 6 }} />
              LATEST EARTHQUAKE
            </Text>
            {latestEarthquake ? (
              <Space wrap>
                <Tag 
                  color={getMagnitudeColor(latestEarthquake.magnitude)}
                  style={{ fontWeight: 'bold', fontSize: 14 }}
                >
                  M {latestEarthquake.magnitude?.toFixed(1)} - {getMagnitudeLabel(latestEarthquake.magnitude)}
                </Tag>
                <Text style={{ color: '#fff', fontSize: 13 }} ellipsis={{ tooltip: true }}>
                  {latestEarthquake.place || 'Unknown location'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                  {dayjs(latestEarthquake.time).format('HH:mm:ss')}
                </Text>
              </Space>
            ) : (
              <Text style={{ color: 'rgba(255,255,255,0.7)' }}>No data available</Text>
            )}
          </Space>
        </Col>

        {/* Auto Refresh Status */}
        <Col xs={24} sm={8} md={6} lg={4}>
          <Space direction="vertical" size={4} style={{ width: '100%', alignItems: 'flex-end' }}>
            <Space>
              {autoRefresh && (
                <Tooltip title={`Next refresh in ${countdown}s`}>
                  <Tag 
                    icon={isRefreshing ? <SyncOutlined spin /> : <CloudSyncOutlined />}
                    color={isRefreshing ? 'processing' : 'blue'}
                    style={{ margin: 0 }}
                  >
                    {isRefreshing ? 'Updating...' : `${countdown}s`}
                  </Tag>
                </Tooltip>
              )}
              <Button 
                type="primary" 
                ghost
                size="small"
                icon={<ReloadOutlined spin={isRefreshing} />}
                onClick={fetchLatestData}
                loading={isRefreshing}
                style={{ borderColor: 'rgba(255,255,255,0.5)', color: '#fff' }}
              >
                Refresh
              </Button>
            </Space>
            {error && (
              <Tooltip title={error}>
                <Tag color="error" icon={<ExclamationCircleOutlined />}>
                  Error
                </Tag>
              </Tooltip>
            )}
          </Space>
        </Col>
      </Row>
    </Card>
  );
};

export default RealtimeStatus;
