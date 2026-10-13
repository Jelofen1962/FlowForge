import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataPage, LogicPage, ProfilesPage } from '../advanced';

describe('advanced workspace pages', () => {
  const notify = vi.fn();
  beforeEach(() => { localStorage.clear(); notify.mockClear(); });
  it('creates and persists a browser profile', () => {
    render(<ProfilesPage notify={notify} />);
    fireEvent.change(screen.getByPlaceholderText('New profile name…'), { target: { value: 'Regression profile' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save profiles' }));
    const profiles = JSON.parse(localStorage.getItem('cobweb.profiles') || '[]');
    expect(profiles.some((profile: { name: string }) => profile.name === 'Regression profile')).toBe(true);
  });
  it('filters JSON sample records through the query UI', () => {
    render(<DataPage notify={notify} />);
    fireEvent.change(screen.getByDisplayValue('status'), { target: { value: 'user.age' } });
    fireEvent.change(screen.getByDisplayValue('active'), { target: { value: '25' } });
    fireEvent.change(screen.getByDisplayValue('=='), { target: { value: '>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run query' }));
    expect(screen.getByText('2 records')).toBeInTheDocument();
    expect(notify).toHaveBeenCalledWith('Query applied to the current dataset');
  });
  it('opens the logic block palette and adds a block', () => {
    render(<LogicPage notify={notify} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add block' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Wait X ms/ }));
    expect(screen.getByText(/3 top-level blocks/)).toBeInTheDocument();
  });
});
