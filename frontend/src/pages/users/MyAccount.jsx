import React, { useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import FormField from '../../components/common/FormField.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { usePageTitle } from '../../context/PageTitleContext.jsx';
import axiosClient from '../../api/axiosClient.js';

export default function MyAccount() {
  usePageTitle('My Account');
  const { user, updateUser } = useAuth();
  const toast = useToast();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Email state
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError('');
    if (!currentPassword || !newPassword) {
      setPasswordError('Please fill in both your current and new password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setSubmittingPassword(true);
    try {
      await axiosClient.patch('/users/me/password', { currentPassword, newPassword });
      toast.success('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err?.response?.data?.message || 'Could not update password. Please check your current password.');
    } finally {
      setSubmittingPassword(false);
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setEmailError('');
    if (!newEmail || !newEmail.includes('@')) {
      setEmailError('Please enter a valid new email address.');
      return;
    }
    if (!emailCurrentPassword) {
      setEmailError('Please enter your current password to confirm email change.');
      return;
    }
    setSubmittingEmail(true);
    try {
      const res = await axiosClient.patch('/users/me/email', {
        currentPassword: emailCurrentPassword,
        newEmail,
      });
      const { user: updatedUser, accessToken } = res.data.data;
      updateUser(updatedUser, accessToken);
      toast.success('Email address updated successfully.');
      setNewEmail('');
      setEmailCurrentPassword('');
    } catch (err) {
      setEmailError(err?.response?.data?.message || 'Could not update email address.');
    } finally {
      setSubmittingEmail(false);
    }
  }

  return (
    <div className="page-body">
      <PageHeader title="My Account" description="Your admin profile, credentials, and account security settings." />

      {/* Profile summary */}
      <div className="card mb-6">
        <div className="card-header"><span className="card-title">Profile Summary</span></div>
        <div className="form-grid" style={{ padding: '1rem' }}>
          <FormField label="Full Name"><input className="form-control" value={user?.name || ''} disabled /></FormField>
          <FormField label="Current Email"><input className="form-control" value={user?.email || ''} disabled /></FormField>
          <FormField label="Role"><input className="form-control" value={user?.role || 'Admin'} disabled /></FormField>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* Email Update Form */}
        <div className="card">
          <div className="card-header"><span className="card-title">Change Account Email</span></div>
          <form onSubmit={handleEmailSubmit}>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <FormField label="New Email Address" required>
                <input
                  type="email"
                  className="form-control"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email address"
                  autoComplete="email"
                />
              </FormField>
              <FormField label="Confirm Current Password" required>
                <input
                  type="password"
                  className="form-control"
                  value={emailCurrentPassword}
                  onChange={(e) => setEmailCurrentPassword(e.target.value)}
                  placeholder="Enter current password to verify identity"
                  autoComplete="current-password"
                />
              </FormField>
            </div>
            {emailError && <div className="form-error" style={{ padding: '0 1rem 1rem', color: 'var(--color-danger, #b42318)' }}>{emailError}</div>}
            <div style={{ padding: '0 1rem 1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submittingEmail}>
                {submittingEmail ? 'Updating Email…' : 'Update Email Address'}
              </button>
            </div>
          </form>
        </div>

        {/* Password Update Form */}
        <div className="card">
          <div className="card-header"><span className="card-title">Change Password</span></div>
          <form onSubmit={handlePasswordSubmit}>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <FormField label="Current Password" required>
                <input
                  type="password"
                  className="form-control"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </FormField>
              <FormField label="New Password" required>
                <input
                  type="password"
                  className="form-control"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </FormField>
              <FormField label="Confirm New Password" required>
                <input
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </FormField>
            </div>
            {passwordError && <div className="form-error" style={{ padding: '0 1rem 1rem', color: 'var(--color-danger, #b42318)' }}>{passwordError}</div>}
            <div style={{ padding: '0 1rem 1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submittingPassword}>
                {submittingPassword ? 'Updating Password…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
