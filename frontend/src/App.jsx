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
  const getInitialView = () => {
    if (localStorage.getItem('adminToken')) return 'admin';
    if (localStorage.getItem('userToken')) return 'citizen';
    return 'landing';
  };
  const [currentView, setCurrentView] = useState(getInitialView()); // 'landing', 'user-login', 'user-signup', 'citizen', 'login', 'admin'
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || '');
  const [adminUser, setAdminUser] = useState(localStorage.getItem('adminUser') || '');
  const [userToken, setUserToken] = useState(localStorage.getItem('userToken') || '');
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || '');

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
  const [severityFilter, setSeverityFilter] = useState('');
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

  // User Sign In & Sign Up Form Data
  const [userLoginData, setUserLoginData] = useState({ email: '', password: '' });
  const [userRegisterData, setUserRegisterData] = useState({ 
    name: '', 
    email: '', 
    password: '',
    securityQuestion: '',
    securityAnswer: ''
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null); // { type: 'success' | 'danger' | 'info', message: '' }
  const [expandedDuplicates, setExpandedDuplicates] = useState({}); // maps issue._id to boolean
  
  // Leaderboard States
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedCitizen, setSelectedCitizen] = useState(null);

  // Change Password Modal States
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordData, setChangePasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Forgot Password / Recovery States
  const [forgotPasswordStep, setForgotPasswordStep] = useState(0); // 0 = off, 1 = enter email, 2 = verify question & reset
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');

  // Admin Status Update State (temp holder for each card's selected status)
  const [tempStatus, setTempStatus] = useState({});

  // Additional UI states
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [locationError, setLocationError] = useState(false);

  // Page Navigation & Theme Switcher States
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [activeTab, setActiveTab] = useState(localStorage.getItem('activeTab') || 'home');

  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-theme' : '';
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (currentView === 'landing') {
      setCurrentView('citizen');
      setActiveTab('home');
    }
  }, [currentView]);

  // Google OAuth Auth Callback
  const handleGoogleAuthCallback = async (response) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/user/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: response.credential })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userName', data.user.name);
        setUserToken(data.token);
        setUserEmail(data.user.email);
        setUserName(data.user.name);
        setCurrentView('citizen');
        showAlert('success', `Signed in via Google successfully! Welcome, ${data.user.name}.`);
      } else {
        showAlert('danger', data.message || 'Google authentication failed.');
      }
    } catch (err) {
      showAlert('danger', 'Failed to connect to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  // Google GSI Client Script Button Rendering
  useEffect(() => {
    const initializeGoogleAuth = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "1050818081119-vgq6c8lplcpoa772igmkdudff41c8s9b.apps.googleusercontent.com",
          callback: handleGoogleAuthCallback
        });

        const loginBtn = document.getElementById("google-signin-login-btn");
        if (loginBtn) {
          window.google.accounts.id.renderButton(loginBtn, {
            theme: "outline",
            size: "large",
            width: 320
          });
        }

        const signupBtn = document.getElementById("google-signin-signup-btn");
        if (signupBtn) {
          window.google.accounts.id.renderButton(signupBtn, {
            theme: "outline",
            size: "large",
            width: 320
          });
        }
      }
    };

    let attempts = 0;
    const interval = setInterval(() => {
      if (window.google) {
        initializeGoogleAuth();
        clearInterval(interval);
      } else {
        attempts++;
        if (attempts >= 10) clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, [currentView]);

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
    if (currentView === 'citizen' || currentView === 'admin') {
      fetchIssues(1);
      fetchAnalytics();
      fetchLeaderboard();
    }
  }, [currentView, debouncedSearch, stateFilter, statusFilter, categoryFilter, severityFilter, sortBy]);

  // Background polling to synchronize state with server in real-time (every 15 seconds)
  useEffect(() => {
    if (currentView !== 'citizen' && currentView !== 'admin') return;
    const interval = setInterval(() => {
      fetchIssues(currentPage);
      fetchAnalytics();
      fetchLeaderboard();
    }, 15000);
    return () => clearInterval(interval);
  }, [currentView, currentPage, debouncedSearch, stateFilter, statusFilter, categoryFilter, severityFilter, sortBy]);

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
      if (severityFilter) query += `&severity=${encodeURIComponent(severityFilter)}`;
      
      // If admin view, allow seeing archived
      if (currentView === 'admin') {
        query += `&includeArchived=true`;
      }

      const headers = {};
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      } else if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }

      const res = await fetch(`${API_BASE_URL}/issues${query}`, { headers });
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
      const headers = {};
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      } else if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }
      const res = await fetch(`${API_BASE_URL}/issues/analytics`, { headers });
      const data = await res.json();
      if (res.ok) {
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      let query = `?sortBy=${sortBy}`;
      if (debouncedSearch) query += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (stateFilter) query += `&state=${encodeURIComponent(stateFilter)}`;
      if (statusFilter) query += `&status=${encodeURIComponent(statusFilter)}`;
      if (categoryFilter) query += `&issueType=${encodeURIComponent(categoryFilter)}`;
      if (severityFilter) query += `&severity=${encodeURIComponent(severityFilter)}`;

      const headers = {};
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      } else if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }

      const res = await fetch(`${API_BASE_URL}/issues/leaderboard${query}`, { headers });
      const data = await res.json();
      if (res.ok) {
        setLeaderboardData(data);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
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
    setLocationError(false);
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
      const headers = {};
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }

      const res = await fetch(`${API_BASE_URL}/issues`, {
        method: 'POST',
        headers,
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
        if (data.isLocationMismatch) {
          setLocationError(true);
          showAlert('danger', `Location mismatch: ${data.message}`);
        } else if (data.isInvalidReport) {
          showAlert('danger', `Validation warning: add valid issue. ${data.message || 'The uploaded image does not correspond to the details.'}`);
        } else {
          showAlert('danger', data.message || 'Failed to submit issue.');
        }
      }
    } catch (err) {
      showAlert('danger', 'Server connection failed. Could not upload report.');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // Citizen / User Handlers
  // ----------------------------------------------------
  const handleUserLoginChange = (e) => {
    const { name, value } = e.target;
    setUserLoginData(prev => ({ ...prev, [name]: value }));
  };

  const handleUserRegisterChange = (e) => {
    const { name, value } = e.target;
    setUserRegisterData(prev => ({ ...prev, [name]: value }));
  };

  const handleUserLogin = async (e) => {
    e.preventDefault();
    if (!userLoginData.email || !userLoginData.password) {
      showAlert('danger', 'Please enter all fields.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userLoginData)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userName', data.user.name);
        localStorage.setItem('userEmail', data.user.email);
        setUserToken(data.token);
        setUserName(data.user.name);
        setUserEmail(data.user.email);
        setCurrentView('citizen');
        showAlert('success', `Signed in successfully. Welcome back, ${data.user.name}!`);
        setUserLoginData({ email: '', password: '' });
      } else {
        showAlert('danger', data.message || 'Login failed.');
      }
    } catch (err) {
      showAlert('danger', 'Failed to connect to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserRegister = async (e) => {
    e.preventDefault();
    if (!userRegisterData.name || !userRegisterData.email || !userRegisterData.password || !userRegisterData.securityQuestion || !userRegisterData.securityAnswer) {
      showAlert('danger', 'Please enter all fields, including security question and answer.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/user/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userRegisterData)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userName', data.user.name);
        localStorage.setItem('userEmail', data.user.email);
        setUserToken(data.token);
        setUserName(data.user.name);
        setUserEmail(data.user.email);
        setCurrentView('citizen');
        showAlert('success', `Account created successfully! Welcome, ${data.user.name}.`);
        setUserRegisterData({ name: '', email: '', password: '', securityQuestion: '', securityAnswer: '' });
      } else {
        showAlert('danger', data.message || 'Registration failed.');
      }
    } catch (err) {
      showAlert('danger', 'Failed to connect to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = changePasswordData;

    if (newPassword !== confirmPassword) {
      showAlert('danger', 'New passwords do not match!');
      return;
    }

    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      let endpoint = '';

      if (currentView === 'admin') {
        headers['Authorization'] = `Bearer ${adminToken}`;
        endpoint = `${API_BASE_URL}/auth/admin/change-password`;
      } else {
        headers['Authorization'] = `Bearer ${userToken}`;
        endpoint = `${API_BASE_URL}/auth/user/change-password`;
      }

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();

      if (res.ok) {
        showAlert('success', data.message || 'Password changed successfully!');
        setShowChangePasswordModal(false);
        setChangePasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        showAlert('danger', data.message || 'Failed to update password.');
      }
    } catch (err) {
      showAlert('danger', 'Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordRequest = async (e) => {
    e.preventDefault();
    if (!recoveryEmail) {
      showAlert('danger', 'Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/user/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail })
      });
      const data = await res.json();

      if (res.ok) {
        setRecoveryQuestion(data.securityQuestion);
        setForgotPasswordStep(2);
        showAlert('info', 'Verify security question to reset password.');
      } else {
        showAlert('danger', data.message || 'Verification failed.');
      }
    } catch (err) {
      showAlert('danger', 'Failed to connect to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!recoveryAnswer || !recoveryNewPassword || !recoveryConfirmPassword) {
      showAlert('danger', 'Please enter all fields.');
      return;
    }

    if (recoveryNewPassword !== recoveryConfirmPassword) {
      showAlert('danger', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/user/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recoveryEmail,
          securityAnswer: recoveryAnswer,
          newPassword: recoveryNewPassword
        })
      });
      const data = await res.json();

      if (res.ok) {
        showAlert('success', data.message || 'Password reset successfully! Please sign in.');
        // Reset states
        setForgotPasswordStep(0);
        setRecoveryEmail('');
        setRecoveryQuestion('');
        setRecoveryAnswer('');
        setRecoveryNewPassword('');
        setRecoveryConfirmPassword('');
        setCurrentView('user-login');
      } else {
        showAlert('danger', data.message || 'Failed to reset password.');
      }
    } catch (err) {
      showAlert('danger', 'Failed to connect to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    setUserToken('');
    setUserName('');
    setUserEmail('');
    setCurrentView('landing');
    showAlert('info', 'Logged out successfully.');
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
    setCurrentView('landing');
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

      <header className="main-header">
        {/* Row 1: Logo & User Actions */}
        <div className="header-top-row">
          <div className="logo-section" onClick={() => setActiveTab('home')} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <span>📢</span> CivicOS AI
              </h1>
              <span className={`api-status-badge ${isApiConnected ? 'connected' : ''}`}>
                <span className="status-dot"></span>
                {isApiConnected ? 'DB Connected' : 'DB Disconnected'}
              </span>
            </div>
            <p className="logo-subtext" style={{ margin: '4px 0 0 0' }}>Hyperlocal Problem Solver | Verified Community Infrastructure Hub</p>
          </div>

          <div className="nav-buttons">
            <button 
              className="theme-toggle-btn"
              onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              type="button"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {userToken ? (
              <>
                <div className="profile-badge-pill" style={{ height: '38px', display: 'flex', alignItems: 'center' }}>
                  <div className="profile-badge-avatar">👤</div>
                  <div className="profile-badge-info">
                    <span className="profile-badge-name">{userName}</span>
                    <span className="profile-badge-role">Citizen</span>
                  </div>
                </div>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setShowChangePasswordModal(true)}
                  style={{ height: '38px', padding: '0 12px' }}
                >
                  🔑 Password
                </button>
                <button className="btn btn-danger" onClick={handleUserLogout} style={{ height: '38px', padding: '0 16px' }}>
                  Log Out
                </button>
              </>
            ) : adminToken ? (
              <>
                <div className="profile-badge-pill" style={{ height: '38px', display: 'flex', alignItems: 'center' }}>
                  <div className="profile-badge-avatar">🛡️</div>
                  <div className="profile-badge-info">
                    <span className="profile-badge-name">{adminUser}</span>
                    <span className="profile-badge-role">Admin</span>
                  </div>
                </div>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setShowChangePasswordModal(true)}
                  style={{ height: '38px', padding: '0 12px' }}
                >
                  🔑 Password
                </button>
                <button className="btn btn-danger" onClick={handleAdminLogout} style={{ height: '38px', padding: '0 16px' }}>
                  Log Out
                </button>
              </>
            ) : (
              <>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setCurrentView('login');
                  }}
                  style={{ height: '38px' }}
                >
                  🛡️ Admin Sign In
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setCurrentView('user-login');
                    setForgotPasswordStep(0);
                  }}
                  style={{ height: '38px' }}
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Page Tabs Navigation */}
        <div className="header-bottom-row">
          <div className="header-nav-tabs">
            <button 
              className={`header-nav-tab ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              Home
            </button>
            <button 
              className={`header-nav-tab ${activeTab === 'problems' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('problems');
                if (userToken) {
                  setCurrentView('citizen');
                } else if (adminToken) {
                  setCurrentView('admin');
                } else {
                  setCurrentView('citizen');
                }
                fetchIssues(1);
              }}
            >
              Problems Feed
            </button>
            <button 
              className={`header-nav-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('leaderboard');
                fetchLeaderboard();
              }}
            >
              Leaderboard
            </button>
            {adminToken && (
              <button 
                className={`header-nav-tab ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('admin');
                  setCurrentView('admin');
                  fetchIssues(1);
                }}
              >
                🛡️ Admin Feed
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Analytics Panel */}
      {/* Analytics Panel */}
      {activeTab === 'problems' && !['user-login', 'user-signup', 'login'].includes(currentView) && (
        <div className="analytics-grid">
          <div className="stat-card total">
            <div className="stat-card-left">
              <div className="stat-label">Total Reports</div>
              <div className="stat-val">{analytics.total}</div>
            </div>
            <div className="stat-card-icon">📊</div>
          </div>
          <div className="stat-card pending">
            <div className="stat-card-left">
              <div className="stat-label">Pending Reviews</div>
              <div className="stat-val">{analytics.pending}</div>
            </div>
            <div className="stat-card-icon">⏳</div>
          </div>
          <div className="stat-card resolved">
            <div className="stat-card-left">
              <div className="stat-label">Resolved Issues</div>
              <div className="stat-val">{analytics.resolved}</div>
            </div>
            <div className="stat-card-icon">✅</div>
          </div>
          <div className="stat-card critical">
            <div className="stat-card-left">
              <div className="stat-label">Critical Hazards</div>
              <div className="stat-val">{analytics.critical}</div>
            </div>
            <div className="stat-card-icon">🚨</div>
          </div>
          <div className="stat-card today">
            <div className="stat-card-left">
              <div className="stat-label">Reported Today</div>
              <div className="stat-val">{analytics.todayReports}</div>
            </div>
            <div className="stat-card-icon">📅</div>
          </div>
        </div>
      )}

      {/* Unique Premium Landing Page */}
      {activeTab === 'home' && !['user-login', 'user-signup', 'login'].includes(currentView) && (
        <div className="landing-hero-container">
          <h1 className="landing-hero-title">
            Empower. Report. <span>Resolve.</span>
          </h1>
          <p className="landing-hero-subtitle">
            CivicOS AI is a community-led coordination platform. Report local infrastructure issues, verify resolved hazards with AI-extracted summaries, and build neighborhood trust.
          </p>
          <button 
            className="landing-cta-button"
            onClick={() => {
              setActiveTab('problems');
              if (userToken) {
                setCurrentView('citizen');
              } else if (adminToken) {
                setCurrentView('admin');
              } else {
                setCurrentView('citizen');
              }
            }}
          >
            Explore Community Problems →
          </button>

          <div className="landing-features-grid">
            <div className="feature-card">
              <div className="feature-card-icon">📢</div>
              <h3>Report Infrastructure</h3>
              <p>Instantly upload pothole or street light issues with geolocation markers and photos.</p>
            </div>
            <div className="feature-card">
              <div className="feature-card-icon">⚡</div>
              <h3>AI Details Extraction</h3>
              <p>Submit simple descriptions and let our Gemini API parse categories, districts, and coordinates automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-card-icon">🏆</div>
              <h3>Citizen Standings</h3>
              <p>Earn leaderboard points for reporting hazards and helping verify infrastructure resolution.</p>
            </div>
            <div className="feature-card">
              <div className="feature-card-icon">🛡️</div>
              <h3>Verified Resolution</h3>
              <p>Authority dashboards review community fixes, keeping public status records completely transparent.</p>
            </div>
          </div>
        </div>
      )}

      {currentView === 'user-login' && forgotPasswordStep === 0 && (
        <div className="login-card">
          <h2>Citizen Sign In</h2>
          <form onSubmit={handleUserLogin}>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                name="email" 
                className="form-control"
                value={userLoginData.email}
                onChange={handleUserLoginChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                name="password" 
                className="form-control"
                value={userLoginData.password}
                onChange={handleUserLoginChange}
                required
              />
              <a className="forgot-password-link" onClick={() => setForgotPasswordStep(1)}>
                Forgot Password?
              </a>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="social-divider">OR</div>

          <div className="social-btn-container">
            <div className="google-signin-btn-wrapper">
              <div id="google-signin-login-btn"></div>
            </div>
          </div>

          <a className="auth-nav-link" onClick={() => setCurrentView('user-signup')}>
            Don't have an account? Sign Up
          </a>
          <a className="auth-nav-link" onClick={() => setCurrentView('landing')} style={{ marginTop: '8px', fontSize: '11px' }}>
            ← Back to Portal Selection
          </a>
        </div>
      )}

      {currentView === 'user-login' && forgotPasswordStep === 1 && (
        <div className="login-card">
          <h2>Recover Account</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '15px', lineHeight: '1.4' }}>
            Enter your email address to retrieve your security recovery question.
          </p>
          <form onSubmit={handleForgotPasswordRequest}>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                className="form-control"
                placeholder="Enter your email"
                value={recoveryEmail}
                onChange={e => setRecoveryEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '15px' }} disabled={loading}>
              {loading ? 'Verifying...' : 'Next'}
            </button>
          </form>
          <a className="auth-nav-link" onClick={() => { setForgotPasswordStep(0); }} style={{ marginTop: '15px' }}>
            ← Back to Sign In
          </a>
        </div>
      )}

      {currentView === 'user-login' && forgotPasswordStep === 2 && (
        <div className="login-card">
          <h2>Security Verification</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '15px', lineHeight: '1.4' }}>
            Answer your security question below to set a new password.
          </p>
          <form onSubmit={handleResetPasswordSubmit}>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ color: 'white', fontWeight: 'bold' }}>Question:</label>
              <p style={{ margin: '6px 0', fontSize: '14px', color: '#a5b4fc', fontStyle: 'italic', fontWeight: 'bold' }}>
                {recoveryQuestion}
              </p>
            </div>
            <div className="form-group">
              <label>Your Answer</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="Enter answer"
                value={recoveryAnswer}
                onChange={e => setRecoveryAnswer(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input 
                type="password" 
                className="form-control"
                placeholder="Min 6 characters"
                value={recoveryNewPassword}
                onChange={e => setRecoveryNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input 
                type="password" 
                className="form-control"
                placeholder="Confirm password"
                value={recoveryConfirmPassword}
                onChange={e => setRecoveryConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '15px' }} disabled={loading}>
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>
          <a className="auth-nav-link" onClick={() => { setForgotPasswordStep(1); setRecoveryAnswer(''); setRecoveryNewPassword(''); setRecoveryConfirmPassword(''); }} style={{ marginTop: '15px' }}>
            ← Back
          </a>
        </div>
      )}

      {currentView === 'user-signup' && (
        <div className="login-card">
          <h2>Create Citizen Account</h2>
          <form onSubmit={handleUserRegister}>
            <div className="form-group">
              <label>Full Name</label>
              <input 
                type="text" 
                name="name" 
                className="form-control"
                value={userRegisterData.name}
                onChange={handleUserRegisterChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                name="email" 
                className="form-control"
                value={userRegisterData.email}
                onChange={handleUserRegisterChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                name="password" 
                className="form-control"
                value={userRegisterData.password}
                onChange={handleUserRegisterChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Security Recovery Question</label>
              <select
                name="securityQuestion"
                className="form-control"
                value={userRegisterData.securityQuestion}
                onChange={handleUserRegisterChange}
                required
              >
                <option value="">Select a recovery question...</option>
                <option value="What is your mother's maiden name?">What is your mother's maiden name?</option>
                <option value="What was the name of your first pet?">What was the name of your first pet?</option>
                <option value="What city were you born in?">What city were you born in?</option>
                <option value="What was the name of your primary school?">What was the name of your primary school?</option>
              </select>
            </div>

            <div className="form-group">
              <label>Security Recovery Answer</label>
              <input 
                type="text" 
                name="securityAnswer" 
                placeholder="Case-insensitive answer"
                className="form-control"
                value={userRegisterData.securityAnswer}
                onChange={handleUserRegisterChange}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
              {loading ? 'Registering...' : 'Sign Up'}
            </button>
          </form>

          <div className="social-divider">OR</div>

          <div className="social-btn-container">
            <div className="google-signin-btn-wrapper">
              <div id="google-signin-signup-btn"></div>
            </div>
          </div>

          <a className="auth-nav-link" onClick={() => setCurrentView('user-login')}>
            Already have an account? Sign In
          </a>
          <a className="auth-nav-link" onClick={() => setCurrentView('landing')} style={{ marginTop: '8px', fontSize: '11px' }}>
            ← Back to Portal Selection
          </a>
        </div>
      )}

      {currentView === 'login' && (
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
          <a className="auth-nav-link" onClick={() => setCurrentView('landing')} style={{ marginTop: '20px', fontSize: '11px' }}>
            ← Back to Portal Selection
          </a>
        </div>
      )}

      {activeTab === 'problems' && !['user-login', 'user-signup', 'login'].includes(currentView) && (
        <>
          <div className="main-grid">
            {/* Left column - Submission form */}
          {currentView !== 'admin' && userToken && (
            <div className="left-column-container" style={{ position: 'relative' }}>
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
                        required
                      >
                        {ISSUE_CATEGORIES.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Detailed Description</label>
                      <textarea 
                        name="description"
                        placeholder="Describe the depth, exact landmark, and hazard history..." 
                        className="form-control"
                        rows="4"
                        value={formData.description}
                        onChange={handleFormChange}
                        required
                      ></textarea>
                    </div>

                    <div className="form-group">
                      <label>Location Details (State, District, Place)</label>
                      <select 
                        name="state" 
                        className={`form-control ${locationError ? 'input-error' : ''}`}
                        value={formData.state}
                        onChange={handleFormChange}
                        style={{ marginBottom: '8px' }}
                        required
                      >
                        <option value="">Select Indian State</option>
                        {INDIAN_STATES.map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                      <input 
                        type="text" 
                        name="district"
                        placeholder="District (e.g. Pune, North Delhi)" 
                        className={`form-control ${locationError ? 'input-error' : ''}`}
                        value={formData.district}
                        onChange={handleFormChange}
                        style={{ marginBottom: '8px' }}
                        required
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
              </div>
            )}

          {/* Right column: Issues Section */}
          <div className="issues-feed-section" style={{ gridColumn: (currentView === 'admin' || !userToken) ? '1 / -1' : 'auto' }}>
            
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
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Severity</label>
                    <select 
                      className="form-control"
                      value={severityFilter}
                      onChange={e => setSeverityFilter(e.target.value)}
                    >
                      <option value="">All Severities</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
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
            <div className="feed-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0 }}>
                  {currentView === 'admin' ? '🛡️ Administration Control Feed' : '📢 Public Infrastructure Dashboard'}
                </h2>
                <span className="page-info" style={{ display: 'block', marginTop: '4px' }}>
                  Showing {issues.length} of {totalResults} reports
                </span>
              </div>
              {!userToken && !adminToken && (
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setCurrentView('user-login');
                    setForgotPasswordStep(0);
                    showAlert('info', 'Please sign in or register to submit reports!');
                  }}
                  style={{ gap: '8px' }}
                >
                  📢 Report an Issue
                </button>
              )}
            </div>

            {/* Issues Cards */}
            {loading && issues.length === 0 ? (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', gap: '20px', color: 'var(--text-muted)' }}>
                <div className="loading-spinner"></div>
                <h3 style={{ color: 'white', margin: 0 }}>Connecting to CivicOS database...</h3>
                <p style={{ margin: 0, fontSize: '13px', textAlign: 'center', maxWidth: '380px', lineHeight: '1.5' }}>
                  Our production backend is waking up from inactivity. This may take up to 45–60 seconds on a cold start. Thank you for your patience!
                </p>
              </div>
            ) : issues.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <h3>No infrastructure reports found.</h3>
                <p>Try resetting filters or search query.</p>
              </div>
            ) : (
              <div className="issues-scroll-container">
                <div className="issues-list">
                {issues.filter(issue => (issue.aiDetectedIssue || '').toLowerCase() !== 'none').map((issue) => {
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
                          <div className='issue-details-block'>
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
                            📍{' '}
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

          </div>
        </div>

        {/* Pagination block (now positioned below both form and feed columns) */}
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
      </>
    )}

    {/* Leaderboard Page Tab */}
    {activeTab === 'leaderboard' && !['user-login', 'user-signup', 'login'].includes(currentView) && (
      <div className="card" style={{ maxWidth: '900px', margin: '0 auto', padding: '30px' }}>
        <h2 style={{ marginBottom: '20px' }}>🏆 Citizen Leaderboard</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '25px', lineHeight: '1.5' }}>
          Standings of our community heroes based on resolved neighborhood issues. Keep reporting to climb up!
        </p>

        <div className="leaderboard-container">
          {/* Rankings List */}
          <div className="leaderboard-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {leaderboardData.length === 0 ? (
              <div className="leaderboard-empty">
                No ranked citizens found.
              </div>
            ) : (
              leaderboardData.map((entry, index) => {
                const rank = index + 1;
                return (
                  <div 
                    key={entry._id} 
                    className={`leaderboard-item rank-${rank <= 3 ? rank : 'other'}`}
                    onClick={() => setSelectedCitizen(entry)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 18px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div className="leaderboard-user-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="leaderboard-rank-badge" style={{ fontWeight: 'bold', fontSize: '16px' }}>
                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                      </div>
                      {/* Static User Icon Placeholder instead of dynamic image */}
                      <div className="leaderboard-avatar-placeholder">👤</div>
                      <div className="leaderboard-details" style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="leaderboard-username" style={{ fontWeight: '700', color: 'var(--text)' }}>{entry.name}</span>
                        <span className="leaderboard-useremail" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{entry.email}</span>
                      </div>
                    </div>
                    
                    <div className="leaderboard-count-badge" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                      <strong>{entry.totalPoints || 0} pts</strong> ({entry.uniqueReportsCount} reports)
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Profile Detail Popover Modal */}
          {selectedCitizen && (
            <div className="settings-modal-overlay" onClick={() => setSelectedCitizen(null)}>
              <div className="settings-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
                <button 
                  className="leaderboard-close-btn" 
                  onClick={() => setSelectedCitizen(null)}
                  style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
                >
                  &times;
                </button>
                
                <div className="citizen-details-profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' }}>
                  <div className="citizen-details-avatar-placeholder">👤</div>
                  <div className="citizen-details-name" style={{ fontSize: '20px', fontWeight: '800', margin: '10px 0 4px 0', color: 'var(--text)' }}>{selectedCitizen.name}</div>
                  <div className="citizen-details-email" style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>{selectedCitizen.email}</div>
                  
                  <div className="citizen-points-bubble" style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '6px 14px', borderRadius: '99px', fontSize: '14px', fontWeight: '700' }}>
                    🏆 <span>{selectedCitizen.totalPoints || 0} Points</span>
                  </div>
                </div>
                
                <div className="citizen-stats-section" style={{ width: '100%' }}>
                  <div className="citizen-stats-title" style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.5px' }}>Severity breakdown</div>
                  <div className="citizen-breakdown-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="citizen-breakdown-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span className="severity-label">🚨 Critical (50 pts)</span>
                      <span className="severity-count critical" style={{ fontWeight: '700', color: 'var(--severity-critical)' }}>{selectedCitizen.criticalCount || 0}</span>
                    </div>
                    <div className="citizen-breakdown-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span className="severity-label">🟠 High (40 pts)</span>
                      <span className="severity-count high" style={{ fontWeight: '700', color: 'var(--severity-high)' }}>{selectedCitizen.highCount || 0}</span>
                    </div>
                    <div className="citizen-breakdown-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span className="severity-label">🟡 Medium (30 pts)</span>
                      <span className="severity-count medium" style={{ fontWeight: '700', color: 'var(--severity-medium)' }}>{selectedCitizen.mediumCount || 0}</span>
                    </div>
                    <div className="citizen-breakdown-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span className="severity-label">🟢 Low (20 pts)</span>
                      <span className="severity-count low" style={{ fontWeight: '700', color: 'var(--severity-low)' }}>{selectedCitizen.lowCount || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {showChangePasswordModal && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card">
            <h2>🔑 Change Password</h2>
            <p>Enter your current password and a new secure password of at least 6 characters.</p>
            
            <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {/* Only require current password for non-oauth profiles */}
              {currentView === 'admin' || userEmail ? (
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Current Password</label>
                  <input 
                    type="password" 
                    className="form-control"
                    placeholder="Enter current password"
                    value={changePasswordData.currentPassword}
                    onChange={e => setChangePasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    style={{ background: 'rgba(255,255,255,0.03)', color: 'white' }}
                  />
                  {currentView === 'citizen' && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                      * Leave blank if you sign in exclusively via Google.
                    </span>
                  )}
                </div>
              ) : null}
              
              <div className="form-group" style={{ margin: 0 }}>
                <label>New Password</label>
                <input 
                  type="password" 
                  className="form-control"
                  placeholder="Min 6 characters"
                  value={changePasswordData.newPassword}
                  onChange={e => setChangePasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  required
                  style={{ background: 'rgba(255,255,255,0.03)', color: 'white' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Confirm New Password</label>
                <input 
                  type="password" 
                  className="form-control"
                  placeholder="Confirm new password"
                  value={changePasswordData.confirmPassword}
                  onChange={e => setChangePasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                  style={{ background: 'rgba(255,255,255,0.03)', color: 'white' }}
                />
              </div>

              <div className="modal-action-buttons">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { setShowChangePasswordModal(false); setChangePasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Site Footer */}
      <footer className="site-footer">
        <div className="footer-grid">
          <div className="footer-col">
            <h3>🏛️ CivicOS AI</h3>
            <p>AI-powered hyper-local community solver where citizens report, track, and resolve public infrastructure hazards.</p>
          </div>
          <div className="footer-col">
            <h3>⚙️ System Workflow</h3>
            <p>Workflow Pipeline: Reported ➔ Verified by AI ➔ Dispatched ➔ Resolved</p>
            <span className="footer-author-badge">Designed & Developed by Aditya Sharma</span>
          </div>
          <div className="footer-col">
            <h3>🛠️ Core Technology Stack</h3>
            <p>Built using React + Vite, Node.js & Express, Google Gemini 3.1 Flash-Lite API, and Firebase. Fully open-source under MIT.</p>
            <span className="footer-copyright">© 2026 CivicOS AI. Open Source.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
