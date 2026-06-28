import React, { useState, useEffect } from 'react';
import './App.css';

let rawApiBase = import.meta.env.VITE_API_BASE_URL || (
  window.location.origin.includes('localhost')
    ? 'http://localhost:5000/api'
    : 'https://civicos-ai.onrender.com/api'
);

// If VITE_API_BASE_URL is set but lacks /api prefix, auto-append it
if (rawApiBase && !rawApiBase.endsWith('/api') && !rawApiBase.endsWith('/api/')) {
  rawApiBase = rawApiBase.endsWith('/') ? `${rawApiBase.slice(0, -1)}/api` : `${rawApiBase}/api`;
}
const API_BASE_URL = rawApiBase;

let rawStaticBase = import.meta.env.VITE_STATIC_BASE_URL || (
  window.location.origin.includes('localhost')
    ? 'http://localhost:5000'
    : 'https://civicos-ai.onrender.com'
);
if (rawStaticBase && rawStaticBase.endsWith('/')) {
  rawStaticBase = rawStaticBase.slice(0, -1);
}
const STATIC_BASE_URL = rawStaticBase;

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

const ISSUE_CATEGORIES = [
  'Pothole',
  'Water Leakage',
  'Damaged Streetlight',
  'Waste Management',
  'Public Infrastructure',
  'Other'
];

function App() {
  // Navigation & Views
  const [currentView, setCurrentView] = useState(localStorage.getItem('adminToken') ? 'admin' : 'citizen'); // 'citizen', 'login', 'admin'
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || '');
  const [adminUser, setAdminUser] = useState(localStorage.getItem('adminUser') || '');

  // Issue Lists & Feed
  const [issues, setIssues] = useState([]);
  const [analytics, setAnalytics] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    critical: 0,
    todayReports: 0
  });

  // Pagination & Filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Issue Reporting Form
  const [formData, setFormData] = useState({
    subject: '',
    issueType: 'Pothole',
    description: '',
    state: '',
    district: '',
    place: '',
    latitude: '',
    longitude: '',
    image: null
  });
  const [imagePreview, setImagePreview] = useState('');

  // Admin Login Form
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null); // { type: 'success' | 'danger' | 'info', message: '' }
  const [expandedDuplicates, setExpandedDuplicates] = useState({}); // maps issue._id to boolean

  // Admin Status Update State (temp holder for each card's selected status)
  const [tempStatus, setTempStatus] = useState({});

  // Additional UI states
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ----------------------------------------------------
  // Debounce search input dynamically
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 350); // 350ms delay
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Initial Loads & Side Effects
  // ----------------------------------------------------
  useEffect(() => {
    fetchIssues(1);
    fetchAnalytics();
  }, [debouncedSearch, stateFilter, statusFilter, categoryFilter, sortBy]);

  // Check backend server connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch(STATIC_BASE_URL);
        if (res.ok) {
          setIsApiConnected(true);
        }
      } catch (err) {
        console.error('API connection check failed:', err);
        setIsApiConnected(false);
      }
    };
    checkConnection();
  }, []);

  // ----------------------------------------------------
  // API Calls
  // ----------------------------------------------------
  const fetchIssues = async (page = 1) => {
    setLoading(true);
    try {
      // Build query string
      let query = `?page=${page}&limit=5&sortBy=${sortBy}`;
      if (debouncedSearch) query += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (stateFilter) query += `&state=${encodeURIComponent(stateFilter)}`;
      if (statusFilter) query += `&status=${encodeURIComponent(statusFilter)}`;
      if (categoryFilter) query += `&issueType=${encodeURIComponent(categoryFilter)}`;
      
      // If admin view, allow seeing archived
      if (currentView === 'admin') {
        query += `&includeArchived=true`;
      }

      const res = await fetch(`${API_BASE_URL}/issues${query}`);
      const data = await res.json();
      if (res.ok) {
        setIssues(data.issues);
        setCurrentPage(data.pagination.currentPage);
        setTotalPages(data.pagination.totalPages);
        setTotalResults(data.pagination.totalResults);
      } else {
        showAlert('danger', data.message || 'Error fetching reports.');
      }
    } catch (err) {
      showAlert('danger', 'Could not connect to the API. Make sure the backend server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/issues/analytics`);
      const data = await res.json();
      if (res.ok) {
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      setAlert(null);
    }, 6000);
  };

  // ----------------------------------------------------
  // Geolocation Handler
  // ----------------------------------------------------
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showAlert('danger', 'Geolocation is not supported by your browser.');
      return;
    }
    
    setIsGpsLoading(true);
    showAlert('info', 'Acquiring GPS coordinates from device...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6)
        }));
        showAlert('success', 'GPS coordinates loaded successfully.');
        setIsGpsLoading(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        showAlert('danger', 'Unable to retrieve location. Please input manually or grant browser permissions.');
        setIsGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ----------------------------------------------------
  // Form Submission
  // ----------------------------------------------------
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // File validation
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      showAlert('danger', 'Invalid file type. Only JPEG, JPG, and PNG are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showAlert('danger', 'File size exceeds 5MB limit.');
      return;
    }

    setFormData(prev => ({ ...prev, image: file }));
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, image: null }));
    setImagePreview('');
    const fileInput = document.getElementById('imageFile');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    
    // Validate inputs
    const { subject, issueType, description, state, district, place, latitude, longitude, image } = formData;
    if (!subject || !issueType || !description || !state || !district || !place || !latitude || !longitude || !image) {
      showAlert('danger', 'Please enter all fields and upload a valid image.');
      return;
    }

    setLoading(true);
    const postData = new FormData();
    postData.append('subject', subject);
    postData.append('issueType', issueType);
    postData.append('description', description);
    postData.append('state', state);
    postData.append('district', district);
    postData.append('place', place);
    postData.append('latitude', latitude);
    postData.append('longitude', longitude);
    postData.append('image', image);

    try {
      const res = await fetch(`${API_BASE_URL}/issues`, {
        method: 'POST',
        body: postData
      });
      const data = await res.json();
      
      if (res.ok) {
        showAlert('success', data.message || 'Issue report submitted successfully!');
        // Reset form
        setFormData({
          subject: '',
          issueType: 'Pothole',
          description: '',
          state: '',
          district: '',
          place: '',
          latitude: '',
          longitude: '',
          image: null
        });
        setImagePreview('');
        fetchIssues(1);
        fetchAnalytics();
      } else {
        showAlert('danger', data.message || 'Failed to submit issue.');
      }
    } catch (err) {
      showAlert('danger', 'Server connection failed. Could not upload report.');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // Admin Handlers
  // ----------------------------------------------------
  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({ ...prev, [name]: value }));
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!loginData.username || !loginData.password) {
      showAlert('danger', 'Please input both username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', data.admin.username);
        setAdminToken(data.token);
        setAdminUser(data.admin.username);
        setCurrentView('admin');
        showAlert('success', `Welcome back, ${data.admin.username}! Admin session active.`);
        // Reset login inputs
        setLoginData({ username: '', password: '' });
      } else {
        showAlert('danger', data.message || 'Login failed. Invalid credentials.');
      }
    } catch (err) {
      showAlert('danger', 'Auth connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setAdminToken('');
    setAdminUser('');
    setCurrentView('citizen');
    showAlert('info', 'Logged out of admin panel successfully.');
  };

  const handleUpdateStatus = async (issueId) => {
    const statusToUpdate = tempStatus[issueId];
    if (!statusToUpdate) {
      showAlert('danger', 'Please choose a status from the selection menu before updating.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/issues/${issueId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: statusToUpdate })
      });
      const data = await res.json();

      if (res.ok) {
        showAlert('success', `Issue status updated successfully to "${statusToUpdate}".`);
        fetchIssues(currentPage);
        fetchAnalytics();
      } else {
        showAlert('danger', data.message || 'Unauthorized or expired session.');
        if (res.status === 401) {
          handleAdminLogout();
        }
      }
    } catch (err) {
      showAlert('danger', 'Status update failed.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle Duplicates log display
  const toggleDuplicates = (issueId) => {
    setExpandedDuplicates(prev => ({
      ...prev,
      [issueId]: !prev[issueId]
    }));
  };

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      {/* Background Glowing Ambient Orbs */}
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <div className="bg-orb bg-orb-3"></div>
      {/* Alert Header Banner */}
      {alert && (
        <div className={`alert alert-${alert.type}`}>
          <span>{alert.message}</span>
          <button className="close-alert" onClick={() => setAlert(null)}>&times;</button>
        </div>
      )}

      {/* Header Bar */}
      <header>
        <div className="logo-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <h1>CivicOS AI</h1>
            <span className={`api-status-badge ${isApiConnected ? 'connected' : ''}`}>
              <span className="status-dot"></span>
              {isApiConnected ? 'DB Connected' : 'DB Disconnected'}
            </span>
          </div>
          <p>Hyperlocal Problem Solver | Verified Community Infrastructure Hub</p>
        </div>
        <div className="nav-buttons">
          {currentView === 'citizen' && (
            adminToken ? (
              <button className="btn btn-primary" onClick={() => { setCurrentView('admin'); fetchIssues(1); }}>
                🛡️ Admin Panel Dashboard
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={() => setCurrentView('login')}>
                🔒 Admin Login Portal
              </button>
            )
          )}
          {currentView === 'login' && (
            <button className="btn btn-secondary" onClick={() => setCurrentView('citizen')}>
              Public Dashboard
            </button>
          )}
          {currentView === 'admin' && (
            <>
              <span style={{ marginRight: '10px', fontSize: '14px', color: '#94a3b8' }}>
                👤 {adminUser} (Admin)
              </span>
              <button 
                className={`btn ${currentView === 'admin' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => fetchIssues(1)}
                style={{ marginRight: '8px' }}
              >
                Admin Panel Feed
              </button>
              <button className="btn btn-secondary" onClick={() => { setCurrentView('citizen'); fetchIssues(1); }}>
                View Citizen Screen
              </button>
              <button className="btn btn-danger" onClick={handleAdminLogout}>
                Log Out
              </button>
            </>
          )}
        </div>
      </header>

      {/* Analytics Panel */}
      <div className="analytics-grid">
        <div className="stat-card">
          <div className="stat-label">Total Reports</div>
          <div className="stat-val">{analytics.total}</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-label">Pending Reviews</div>
          <div className="stat-val">{analytics.pending}</div>
        </div>
        <div className="stat-card resolved">
          <div className="stat-label">Resolved Issues</div>
          <div className="stat-val">{analytics.resolved}</div>
        </div>
        <div className="stat-card critical">
          <div className="stat-label">Critical Hazards</div>
          <div className="stat-val">{analytics.critical}</div>
        </div>
        <div className="stat-card today">
          <div className="stat-label">Reported Today</div>
          <div className="stat-val">{analytics.todayReports}</div>
        </div>
      </div>

      {/* Main Body Switcher */}
      {currentView === 'login' ? (
        <div className="login-card">
          <h2>Admin Authentication</h2>
          <form onSubmit={handleAdminLogin}>
            <div className="form-group">
              <label>Admin Username</label>
              <input 
                type="text" 
                name="username" 
                className="form-control"
                value={loginData.username}
                onChange={loginChange => handleLoginChange(loginChange)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                name="password" 
                className="form-control"
                value={loginData.password}
                onChange={loginChange => handleLoginChange(loginChange)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      ) : (
        <div className="main-grid">
          {/* Left column - Submission form (only shown in citizen view) */}
          {currentView === 'citizen' && (
            <div className="card reporting-form-card">
              <h2>Report Infrastructure Issue</h2>
              <form onSubmit={handleReportSubmit}>
                <div className="form-group">
                  <label>Subject / Brief Summary</label>
                  <input 
                    type="text" 
                    name="subject"
                    placeholder="e.g. Deep pothole causing skids" 
                    className="form-control"
                    value={formData.subject}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Issue Category</label>
                  <select 
                    name="issueType" 
                    className="form-control"
                    value={formData.issueType}
                    onChange={handleFormChange}
                  >
                    {ISSUE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Detailed Description</label>
                  <textarea 
                    name="description" 
                    rows="3"
                    placeholder="Describe the depth, exact landmark, and hazard history..."
                    className="form-control"
                    value={formData.description}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Location details (State, District, Place)</label>
                  <select 
                    name="state" 
                    className="form-control"
                    value={formData.state}
                    onChange={handleFormChange}
                    required
                    style={{ marginBottom: '8px' }}
                  >
                    <option value="">Select Indian State</option>
                    {INDIAN_STATES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                  <input 
                    type="text" 
                    name="district"
                    placeholder="District (e.g. Pune, North Delhi)" 
                    className="form-control"
                    value={formData.district}
                    onChange={handleFormChange}
                    required
                    style={{ marginBottom: '8px' }}
                  />
                  <input 
                    type="text" 
                    name="place"
                    placeholder="Place / Ward / Near Landmark" 
                    className="form-control"
                    value={formData.place}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Coordinates (Latitude & Longitude)</label>
                  <button type="button" className="btn-geo" onClick={handleGetLocation} style={{ marginBottom: '8px' }} disabled={isGpsLoading}>
                    {isGpsLoading ? <span className="spinner"></span> : '📍'} Detect Current GPS Location
                  </button>
                  <div className="geo-input-group">
                    <input 
                      type="text" 
                      name="latitude"
                      placeholder="Latitude" 
                      className="form-control"
                      value={formData.latitude}
                      onChange={handleFormChange}
                      required
                    />
                    <input 
                      type="text" 
                      name="longitude"
                      placeholder="Longitude" 
                      className="form-control"
                      value={formData.longitude}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Evidence Image Upload (JPEG/PNG, max 5MB)</label>
                  <div className="file-upload-wrapper" onClick={() => document.getElementById('imageFile').click()}>
                    <span className="file-upload-text">
                      📷 {formData.image ? formData.image.name : 'Click to select / upload image'}
                    </span>
                    <input 
                      id="imageFile"
                      type="file" 
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </div>
                  {imagePreview && (
                    <div className="preview-container" style={{ position: 'relative', marginTop: '10px' }}>
                      <img src={imagePreview} alt="Upload preview" className="preview-thumb" />
                      <button 
                        type="button" 
                        className="btn-remove-preview"
                        onClick={handleRemoveImage}
                      >
                        &times; Remove Photo
                      </button>
                    </div>
                  )}
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
                  {loading ? 'Submitting & Running AI Analysis...' : 'Submit Infrastructure Report'}
                </button>
              </form>
            </div>
          )}

          {/* Right column: Issues Section */}
          <div className="issues-feed-section" style={{ gridColumn: currentView === 'admin' ? '1 / -1' : 'auto' }}>
            
            {/* Filter Panel (Now inside the right column, matching its width exactly) */}
            {currentView !== 'login' && (
              <div className="filter-card">
                <form onSubmit={e => e.preventDefault()} className="search-filter-grid">
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Search Subject/ID</label>
                    <input 
                      type="text" 
                      placeholder="Search query..."
                      className="form-control"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>State</label>
                    <select 
                      className="form-control"
                      value={stateFilter}
                      onChange={e => setStateFilter(e.target.value)}
                    >
                      <option value="">All States</option>
                      {INDIAN_STATES.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Category</label>
                    <select 
                      className="form-control"
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                    >
                      <option value="">All Categories</option>
                      {ISSUE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Status</label>
                    <select 
                      className="form-control"
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                    >
                      <option value="">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Under Review">Under Review</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Rejected">Rejected</option>
                      {currentView === 'admin' && <option value="Archived">Archived</option>}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Sort By</label>
                    <select 
                      className="form-control"
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="most-reported">Most Reported</option>
                    </select>
                  </div>
                </form>
              </div>
            )}

            {/* Issues Feed Header */}
            <div className="feed-header">
              <h2>
                {currentView === 'admin' ? '🛡️ Administration Control Feed' : '📢 Public Infrastructure Dashboard'}
              </h2>
              <span className="page-info">
                Showing {issues.length} of {totalResults} reports
              </span>
            </div>

            {/* Issues Cards */}
            {issues.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <h3>No infrastructure reports found.</h3>
                <p>Try resetting filters or search query.</p>
              </div>
            ) : (
              <div className="issues-scroll-container">
                <div className="issues-list">
                {issues.map((issue) => {
                  const statusClass = `pill-${issue.status.toLowerCase().replace(' ', '-')}`;
                  const severityClass = `pill-sev-${issue.severity.toLowerCase()}`;
                  const isExpanded = expandedDuplicates[issue._id] || false;

                  return (
                    <div className={`issue-card severity-${issue.severity.toLowerCase()}`} key={issue._id}>
                      <div className="issue-card-content">
                        {/* Image Panel */}
                        <div className="issue-card-image">
                          <img 
                            src={issue.imageUrl.startsWith('http') ? issue.imageUrl : `${STATIC_BASE_URL}${issue.imageUrl}`} 
                            alt={issue.subject} 
                            onError={(e) => {
                              // If image fails, set generic placeholder
                              e.target.src = 'https://placehold.co/400x300?text=No+Image+Available';
                            }}
                          />
                          {issue.reportCount > 1 && (
                            <span className="report-count-badge">
                              🔥 Duplicate Reports: {issue.reportCount}
                            </span>
                          )}
                        </div>

                        {/* Details Panel */}
                        <div className="issue-details">
                          <div>
                            <div className="issue-top">
                              <div className="issue-id-cat">
                                <span className="issue-id">{issue.readableId}</span>
                                <span className="issue-cat">{issue.issueType}</span>
                              </div>
                              <div className="pills-group">
                                <span className={`pill ${severityClass}`}>
                                  Severity: {issue.severity}
                                </span>
                                <span className={`pill ${statusClass}`}>
                                  {issue.status}
                                </span>
                              </div>
                            </div>

                            <h3 className="issue-subject">{issue.subject}</h3>
                            <p className="issue-desc">{issue.description}</p>
                            
                            {/* Duplicate Reports toggle log */}
                            {issue.duplicateReports && issue.duplicateReports.length > 0 && (
                              <div>
                                <button className="duplicate-reports-toggle" onClick={() => toggleDuplicates(issue._id)}>
                                  {isExpanded ? 'Hide merged duplicate reports ▲' : `Show merged duplicate reports (${issue.duplicateReports.length}) ▼`}
                                </button>
                                {isExpanded && (
                                  <div className="duplicate-reports-list">
                                    {issue.duplicateReports.map((dup, i) => (
                                      <div className="duplicate-report-item" key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                        <div>
                                          <strong>Report {i + 1} ({new Date(dup.reportedAt).toLocaleDateString()}):</strong> {dup.description}
                                          <br />
                                          <span style={{ color: 'var(--primary)', fontWeight: '500' }}>Location: {dup.latitude}, {dup.longitude}</span>
                                        </div>
                                        {dup.imageUrl && (
                                          <a 
                                            href={dup.imageUrl.startsWith('http') ? dup.imageUrl : `${STATIC_BASE_URL}${dup.imageUrl}`} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="btn btn-outline"
                                            style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none' }}
                                          >
                                            🖼️ View Photo
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* AI Analysis block */}
                            {(issue.aiAnalysis || issue.aiDetectedIssue) && (
                              <div className="ai-insights-box">
                                <div className="ai-header">
                                  <span className="ai-title">🧠 Gemini AI Assessment</span>
                                  <span className="ai-confidence">
                                    Confidence: {(issue.aiConfidence * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#93c5fd', marginBottom: '4px' }}>
                                  Detected Issue: {issue.aiDetectedIssue || issue.issueType}
                                </div>
                                <p className="ai-text">
                                  "{issue.aiAnalysis || 'No analysis details provided by AI.'}"
                                </p>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>

                      {/* Bottom Footer Section: Geographical & Reported Info */}
                      <div className="issue-card-footer">
                        <div className="footer-meta-row">
                          <span className="footer-meta-item" title={`${issue.place}, ${issue.district}, ${issue.state}`}>
                            📍 {issue.place}, {issue.district}, {issue.state}
                          </span>
                          <span className="footer-meta-item">
                            🗺️{' '}
                            <a 
                              href={`https://www.google.com/maps?q=${issue.latitude},${issue.longitude}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="coords-link"
                            >
                              {issue.latitude}, {issue.longitude}
                            </a>
                          </span>
                          <span className="footer-meta-item">
                            📅 {new Date(issue.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {/* Admin actions drawer */}
                        {currentView === 'admin' && (
                          <div className="admin-actions-area">
                            <span className="admin-action-label">Authority Action:</span>
                            <div className="admin-controls">
                              <select 
                                className="form-control select-admin-status"
                                value={tempStatus[issue._id] || issue.status}
                                onChange={(e) => {
                                  setTempStatus(prev => ({
                                    ...prev,
                                    [issue._id]: e.target.value
                                  }));
                                }}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Under Review">Under Review</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Resolved">Resolved</option>
                                <option value="Rejected">Rejected</option>
                                <option value="Archived">Archived</option>
                              </select>
                              <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={() => handleUpdateStatus(issue._id)}>
                                Update Status
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            )}

            {/* Pagination block */}
            {totalPages > 1 && (
              <div className="pagination-container">
                <button 
                  className="btn btn-outline" 
                  disabled={currentPage === 1}
                  onClick={() => fetchIssues(currentPage - 1)}
                >
                  ◀ Previous
                </button>
                <span className="page-info">
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </span>
                <button 
                  className="btn btn-outline" 
                  disabled={currentPage === totalPages}
                  onClick={() => fetchIssues(currentPage + 1)}
                >
                  Next ▶
                </button>
              </div>
            )}
          </div>
        </div>
    )}
    </div>
  );
}

export default App;
