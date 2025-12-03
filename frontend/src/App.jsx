import React, { useState, useEffect } from 'react';
import { Layout, Menu, Card, Row, Col, DatePicker, Select, Spin, message, Button, Space, Modal, InputNumber } from 'antd';
import {
  DashboardOutlined,
  LineChartOutlined,
  BarChartOutlined,
  ClusterOutlined,
  RiseOutlined,
  ReloadOutlined,
  DownloadOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

// Import components
import TimeSeriesChart from './components/TimeSeriesChart';
import ScatterPlot from './components/ScatterPlot';
import ScatterPlotSimple from './components/ScatterPlotSimple';
import HistogramChart from './components/HistogramChart';
import HistogramChartSimple from './components/HistogramChartSimple';
import MagnitudeTimeChart from './components/MagnitudeTimeChart';
import CorrelationHeatmap from './components/CorrelationHeatmap';
import SeasonalChart from './components/SeasonalChart';
import PredictionChart from './components/PredictionChart';
import ClusterMap from './components/ClusterMap';
import StatsCards from './components/StatsCards';

const { Header, Content, Sider } = Layout;
const { RangePicker } = DatePicker;
const { Option } = Select;

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  
  // Set default date range to 1 month ago
  const getDefaultDateRange = () => {
    const end = dayjs();
    const start = dayjs().subtract(1, 'month');
    return [start, end];
  };
  
  // Set default map date range to 7 days
  const getDefaultMapDateRange = () => {
    const end = dayjs();
    const start = dayjs().subtract(7, 'day');
    return [start, end];
  };
  
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [mapDateRange, setMapDateRange] = useState(getDefaultMapDateRange());
  const [period, setPeriod] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [loadYears, setLoadYears] = useState(1);
  const [loadingData, setLoadingData] = useState(false);

  // Quick filter for date range
  const setQuickDateRange = (days) => {
    const end = dayjs();
    const start = dayjs().subtract(days, 'day');
    setDateRange([start, end]);
  };

  // Quick filter for map date range
  const setQuickMapDateRange = (days) => {
    const end = dayjs();
    const start = dayjs().subtract(days, 'day');
    setMapDateRange([start, end]);
  };

  // Function to reload data for specific service
  const reloadServiceData = async (serviceName) => {
    setLoadingData(true);
    try {
      let endpoint = '';
      switch(serviceName) {
        case 'analysis':
          endpoint = 'http://localhost:8002/api/analysis/timeseries?period=daily';
          break;
        case 'clustering':
          endpoint = 'http://localhost:8003/api/clusters/geographic';
          break;
        case 'prediction':
          endpoint = 'http://localhost:8004/api/predictions/forecast?days=7';
          break;
        case 'database':
          endpoint = 'http://localhost:8001/api/earthquakes/stats';
          break;
        default:
          endpoint = 'http://localhost:8001/api/earthquakes/stats';
      }
      
      await axios.get(endpoint);
      message.success(`${serviceName} data reloaded successfully!`);
    } catch (error) {
      message.error(`Failed to reload ${serviceName} data: ${error.message}`);
    } finally {
      setLoadingData(false);
    }
  };

  // Function to load historical data
  const loadHistoricalData = async () => {
    setLoadingData(true);
    setLoadModalVisible(false);
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - loadYears);
      
      message.loading(`Loading ${loadYears} year(s) of historical data...`, 0);
      
      // Call data ingestion service to load historical data
      const response = await axios.post('http://localhost:8001/api/earthquakes/load-historical', {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      });
      
      message.destroy();
      message.success(`Successfully loaded ${loadYears} year(s) of data!`);
    } catch (error) {
      message.destroy();
      message.error(`Failed to load historical data: ${error.message}`);
    } finally {
      setLoadingData(false);
    }
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: 'timeseries',
      icon: <LineChartOutlined />,
      label: 'Time Series',
    },
    {
      key: 'analysis',
      icon: <BarChartOutlined />,
      label: 'Analysis',
    },
    {
      key: 'clustering',
      icon: <ClusterOutlined />,
      label: 'Clustering',
    },
    {
      key: 'prediction',
      icon: <RiseOutlined />,
      label: 'Prediction',
    },
  ];

  const renderContent = () => {
    const commonProps = {
      dateRange,
      period,
      loading,
      setLoading,
    };

    switch (selectedMenu) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <StatsCards dateRange={dateRange} />
            
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card title="Earthquake Count Over Time">
                  <TimeSeriesChart {...commonProps} />
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="Magnitude vs Time">
                  <MagnitudeTimeChart {...commonProps} />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Magnitude Distribution">
                  <HistogramChartSimple {...commonProps} />
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card 
                  title="Geographic Clusters"
                  extra={
                    <Space>
                      <span style={{ fontSize: '14px', marginRight: 8 }}>Map Filter:</span>
                      <Button onClick={() => setQuickMapDateRange(7)} size="small" type="primary">7 Days</Button>
                      <Button onClick={() => setQuickMapDateRange(14)} size="small">14 Days</Button>
                      <Button onClick={() => setQuickMapDateRange(30)} size="small">1 Month</Button>
                      <Button onClick={() => setQuickMapDateRange(90)} size="small">3 Months</Button>
                      <RangePicker value={mapDateRange} onChange={setMapDateRange} size="small" style={{ marginLeft: 8 }} />
                    </Space>
                  }
                >
                  <ClusterMap dateRange={mapDateRange} period={period} />
                </Card>
              </Col>
            </Row>
          </div>
        );

      case 'timeseries':
        return (
          <div className="space-y-6">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card 
                  title="Time Series Analysis"
                  extra={
                    <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
                      <Option value="daily">Daily</Option>
                      <Option value="weekly">Weekly</Option>
                      <Option value="monthly">Monthly</Option>
                    </Select>
                  }
                >
                  <TimeSeriesChart {...commonProps} showTrend />
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card title="Seasonal Decomposition">
                  <SeasonalChart {...commonProps} />
                </Card>
              </Col>
            </Row>
          </div>
        );

      case 'analysis':
        return (
          <div className="space-y-6">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="Correlation Matrix">
                  <CorrelationHeatmap {...commonProps} />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Magnitude Distribution">
                  <HistogramChartSimple {...commonProps} />
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card title="Magnitude vs Time">
                  <MagnitudeTimeChart {...commonProps} height={400} />
                </Card>
              </Col>
            </Row>
          </div>
        );

      case 'clustering':
        return (
          <div className="space-y-6">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card 
                  title="Geographic Clustering"
                  extra={
                    <Space>
                      <span style={{ fontSize: '14px', marginRight: 8 }}>Map Filter:</span>
                      <Button onClick={() => setQuickMapDateRange(7)} size="small" type="primary">7 Days</Button>
                      <Button onClick={() => setQuickMapDateRange(14)} size="small">14 Days</Button>
                      <Button onClick={() => setQuickMapDateRange(30)} size="small">1 Month</Button>
                      <Button onClick={() => setQuickMapDateRange(90)} size="small">3 Months</Button>
                      <RangePicker value={mapDateRange} onChange={setMapDateRange} size="small" style={{ marginLeft: 8 }} />
                    </Space>
                  }
                >
                  <ClusterMap dateRange={mapDateRange} period={period} height={500} />
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card title="Magnitude-Depth Clustering">
                  <ScatterPlot {...commonProps} type="clustering" />
                </Card>
              </Col>
            </Row>
          </div>
        );

      case 'prediction':
        return (
          <div className="space-y-6">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card title="Earthquake Count Forecast (Next 7 Days)">
                  <PredictionChart {...commonProps} type="count" />
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="Risk Level Forecast">
                  <PredictionChart {...commonProps} type="risk" />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Magnitude Forecast">
                  <PredictionChart {...commonProps} type="magnitude" />
                </Card>
              </Col>
            </Row>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div className="h-16 m-4 flex items-center justify-center text-white text-xl font-bold">
          {!collapsed ? 'Earthquake System' : 'EQ'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[selectedMenu]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => setSelectedMenu(key)}
        />
      </Sider>

      <Layout>
        <Header 
          style={{ 
            background: '#fff', 
            padding: '0 24px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <h1 className="text-2xl font-bold">Earthquake Analysis Dashboard</h1>
          <Space size="middle">
            <RangePicker value={dateRange} onChange={setDateRange} />
            <Button 
              type="primary" 
              icon={<DatabaseOutlined />}
              onClick={() => setLoadModalVisible(true)}
              loading={loadingData}
            >
              Load Historical Data
            </Button>
          </Space>
        </Header>

        <Content style={{ margin: '24px 16px', padding: 24, background: '#f0f2f5' }}>
          {/* Quick Date Filters */}
          <Card 
            style={{ marginBottom: 16 }}
            bodyStyle={{ padding: '12px 16px' }}
          >
            <Space wrap>
              <span style={{ fontWeight: 'bold', marginRight: 8 }}>Quick Filters:</span>
              <Button onClick={() => setQuickDateRange(7)} size="small">7 Days</Button>
              <Button onClick={() => setQuickDateRange(30)} size="small">1 Month</Button>
              <Button onClick={() => setQuickDateRange(90)} size="small">3 Months</Button>
              <Button onClick={() => setQuickDateRange(180)} size="small">6 Months</Button>
              <Button onClick={() => setQuickDateRange(365)} size="small">1 Year</Button>
              <Button onClick={() => setDateRange(null)} size="small" type="dashed">Clear</Button>
            </Space>
          </Card>

          {/* Service Data Reload Buttons */}
          <Card 
            style={{ marginBottom: 16 }}
            bodyStyle={{ padding: '12px 16px' }}
          >
            <Space wrap>
              <span style={{ fontWeight: 'bold', marginRight: 8 }}>Reload Service Data:</span>
              <Button 
                icon={<ReloadOutlined />}
                onClick={() => reloadServiceData('database')}
                loading={loadingData}
                size="small"
              >
                Database
              </Button>
              <Button 
                icon={<ReloadOutlined />}
                onClick={() => reloadServiceData('analysis')}
                loading={loadingData}
                size="small"
              >
                Analysis
              </Button>
              <Button 
                icon={<ReloadOutlined />}
                onClick={() => reloadServiceData('clustering')}
                loading={loadingData}
                size="small"
              >
                Clustering
              </Button>
              <Button 
                icon={<ReloadOutlined />}
                onClick={() => reloadServiceData('prediction')}
                loading={loadingData}
                size="small"
              >
                Prediction
              </Button>
            </Space>
          </Card>

          {loading ? (
            <div className="flex justify-center items-center h-96">
              <Spin size="large" />
            </div>
          ) : (
            renderContent()
          )}
        </Content>

        {/* Historical Data Load Modal */}
        <Modal
          title="Load Historical Data"
          open={loadModalVisible}
          onOk={loadHistoricalData}
          onCancel={() => setLoadModalVisible(false)}
          okText="Load Data"
          cancelText="Cancel"
          confirmLoading={loadingData}
        >
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <p style={{ marginBottom: 12 }}>Select the number of years of historical data to load:</p>
            <Space>
              <InputNumber 
                min={1} 
                max={10} 
                value={loadYears} 
                onChange={setLoadYears}
                addonAfter="year(s)"
              />
            </Space>
            <p style={{ marginTop: 16, color: '#666', fontSize: '13px' }}>
              <DatabaseOutlined /> This will fetch earthquake data from USGS API for the past {loadYears} year(s).
              <br />
              ⚠️ Note: Loading large amounts of data may take several minutes.
            </p>
          </div>
        </Modal>
      </Layout>
    </Layout>
  );
}

export default App;
