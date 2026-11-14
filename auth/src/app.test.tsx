import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nav } from './nav';
import { mockApi, renderAt, SIGNED_OUT } from './test-utils';

const go = vi.spyOn(nav, 'go').mockImplementation(() => undefined);
beforeEach(() => go.mockClear());
const APP = 'http://localhost:5173'; // default VITE_APP_URL in tests
const token = 'b'.repeat(64);

describe('sign in', () => {
  const signedOutApi = () => mockApi((r) => (r.path === '/auth/me' ? SIGNED_OUT : r.path === '/auth/login' ? { data: { user: { id: '1', name: 'Shefin Franklin', email: 'a@b.com' } } } : undefined));

  it('validates, then signs in and goes to the app', async () => {
    const user = userEvent.setup();
    const calls = signedOutApi();
    renderAt('/login');
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'Passw0rd!x');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(go).toHaveBeenCalledWith(`${APP}/`));
    expect(calls.find((c) => c.path === '/auth/login')!.body).toEqual({ email: 'a@b.com', password: 'Passw0rd!x' });
  });

  it('returns to the page you came from when it is on an allowed origin', async () => {
    const user = userEvent.setup();
    signedOutApi();
    renderAt(`/login?redirect=${encodeURIComponent(`${APP}/fees?tab=1`)}`);
    await user.type(await screen.findByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(go).toHaveBeenCalledWith(`${APP}/fees?tab=1`));
  });

  it('ignores a redirect to any other site', async () => {
    const user = userEvent.setup();
    signedOutApi();
    renderAt(`/login?redirect=${encodeURIComponent('https://evil.example/phish')}`);
    await user.type(await screen.findByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(go).toHaveBeenCalledWith(`${APP}/`));
    expect(go).not.toHaveBeenCalledWith(expect.stringContaining('evil'));
  });

  it('shows a plain message for wrong credentials and stays on the page', async () => {
    const user = userEvent.setup();
    mockApi((r) => (r.path === '/auth/me' ? SIGNED_OUT : r.path === '/auth/login' ? { status: 401, error: { code: 'UNAUTHORIZED', message: 'Incorrect email or password' } } : undefined));
    renderAt('/login');
    await user.type(await screen.findByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('do not match');
    expect(go).not.toHaveBeenCalled();
  });

  it('single sign-on: an existing session goes straight back to the app', async () => {
    mockApi((r) => (r.path === '/auth/me' ? { data: { user: { id: '1', name: 'Shefin Franklin', email: 'a@b.com' } } } : undefined));
    renderAt(`/login?redirect=${encodeURIComponent(`${APP}/budgets`)}`);
    await waitFor(() => expect(go).toHaveBeenCalledWith(`${APP}/budgets`));
    expect(await screen.findByText('Welcome back, Shefin')).toBeInTheDocument();
  });

  it('after signing out it shows the form and does not bounce back', async () => {
    mockApi((r) => (r.path === '/auth/me' ? { data: { user: { id: '1', name: 'S', email: 'a@b.com' } } } : undefined));
    renderAt('/login?signed_out=1');
    expect(await screen.findByText('You are signed out.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(go).not.toHaveBeenCalled();
  });

  it('keeps the redirect choice when moving between sign-in pages', async () => {
    signedOutApi();
    const redirect = `${APP}/fees`;
    renderAt(`/login?redirect=${encodeURIComponent(redirect)}`);
    const create = await screen.findByRole('link', { name: 'Create an account' });
    expect(create.getAttribute('href')).toBe(`/register?redirect=${encodeURIComponent(redirect)}`);
    expect(screen.getByRole('link', { name: 'Forgot password?' }).getAttribute('href')).toBe(`/forgot-password?redirect=${encodeURIComponent(redirect)}`);
  });

  it('unknown paths and / lead to sign in, keeping the query', async () => {
    signedOutApi();
    renderAt('/anything?redirect=' + encodeURIComponent(`${APP}/x`));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('register', () => {
  it('requires the profile fields, sends only filled ones, then goes to the app', async () => {
    const user = userEvent.setup();
    const calls = mockApi((r) => (r.path === '/auth/register' ? { status: 201, data: { user: { id: '1', name: 'S', email: 'a@b.com' } } } : undefined));
    renderAt('/register');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Enter your full name')).toBeInTheDocument();
    expect(screen.getByText('Enter your department')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Full name'), 'Shefin Franklin');
    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'Passw0rd!x');
    await user.type(screen.getByLabelText('Department'), 'Computer Science and Engineering');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(go).toHaveBeenCalledWith(`${APP}/`));
    expect(calls.find((c) => c.path === '/auth/register')!.body).toEqual({ name: 'Shefin Franklin', email: 'a@b.com', password: 'Passw0rd!x', department: 'Computer Science and Engineering', studentYear: 'First Year' });
  });

  it('shows the server message when the email is taken', async () => {
    const user = userEvent.setup();
    mockApi((r) => (r.path === '/auth/register' ? { status: 409, error: { code: 'CONFLICT', message: 'An account with this email already exists' } } : undefined));
    renderAt('/register');
    await user.type(screen.getByLabelText('Full name'), 'S F');
    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'Passw0rd!x');
    await user.type(screen.getByLabelText('Department'), 'CSE');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(go).not.toHaveBeenCalled();
  });
});

describe('forgot and reset password', () => {
  it('gives the same neutral confirmation', async () => {
    const user = userEvent.setup();
    const calls = mockApi((r) => (r.path === '/auth/forgot-password' ? { data: { message: 'ok' } } : undefined));
    renderAt('/forgot-password');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText('Enter your email')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'who@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(/a reset link is on its way/)).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/auth/forgot-password')!.body).toEqual({ email: 'who@example.com' });
  });

  it('rejects weak or mismatched passwords before calling the server', async () => {
    const user = userEvent.setup();
    const calls = mockApi(() => undefined);
    renderAt(`/reset-password?token=${token}`);
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Confirm new password'), 'different1');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('The passwords do not match')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('changes the password and returns to sign in with a success message', async () => {
    const user = userEvent.setup();
    const calls = mockApi((r) => (r.path === '/auth/reset-password' ? { data: null } : r.path === '/auth/me' ? SIGNED_OUT : undefined));
    renderAt(`/reset-password?token=${token}`);
    await user.type(screen.getByLabelText('New password'), 'BrandNew123');
    await user.type(screen.getByLabelText('Confirm new password'), 'BrandNew123');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText(/Password changed/)).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/auth/reset-password')!.body).toEqual({ token, password: 'BrandNew123' });
  });

  it('offers a new link for an expired token and for a malformed link', async () => {
    const user = userEvent.setup();
    mockApi((r) => (r.path === '/auth/reset-password' ? { status: 400, error: { code: 'BAD_REQUEST', message: 'This reset link has expired or was already used. Ask for a new one.' } } : undefined));
    const first = renderAt(`/reset-password?token=${token}`);
    await user.type(screen.getByLabelText('New password'), 'BrandNew123');
    await user.type(screen.getByLabelText('Confirm new password'), 'BrandNew123');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('link', { name: 'Get a new link' })).toBeInTheDocument();
    first.unmount();
    renderAt('/reset-password?token=oops');
    expect(screen.getByRole('heading', { name: 'This link is not valid' })).toBeInTheDocument();
  });
});
