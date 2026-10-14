import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('Cobweb main application shell', () => {
  beforeEach(() => localStorage.clear());
  it('opens the workspace menu and navigates to Settings', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Workspace menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });
  it('defaults to Edge and persists browser preferences', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Workspace menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(screen.getByRole('combobox', { name: 'Browser engine' })).toHaveValue('edge');
    fireEvent.change(screen.getByRole('combobox', { name: 'Browser engine' }), { target: { value: 'chromium' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'DevTools Protocol port' }), { target: { value: '9333' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    const saved = JSON.parse(localStorage.getItem('cobweb.preferences.v1') || '{}');
    expect(saved.browserEngine).toBe('chromium');
    expect(saved.devtoolsPort).toBe(9333);
  });
  it('adds a website and persists the website list', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Websites/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add website' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. My dashboard'), { target: { value: 'QA site' } });
    fireEvent.change(screen.getByPlaceholderText('https://example.com'), { target: { value: 'https://qa.example.com' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add website' }).at(-1)!);
    const sites = JSON.parse(localStorage.getItem('cobweb.sites.v1') || '[]');
    expect(sites.some((site: { name: string; url: string }) => site.name === 'QA site' && site.url === 'https://qa.example.com')).toBe(true);
  });
  it('opens step actions and duplicates a step', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Step 3 actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate step' }));
    expect(screen.getAllByText('Click element copy').length).toBeGreaterThan(0);
  });
  it('persists draft edits to local storage', async () => {
    render(<App />);
    const title = screen.getByDisplayValue('Example site smoke test');
    fireEvent.change(title, { target: { value: 'Regression test workflow' } });
    expect(JSON.parse(localStorage.getItem('cobweb.workflow.v1') || '{}').name).toBe('Regression test workflow');
  });
});
