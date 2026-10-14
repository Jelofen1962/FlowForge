import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DropdownMenu } from '../DropdownMenu';

describe('DropdownMenu', () => {
  it('opens on click and invokes the selected action', () => {
    const action = vi.fn();
    render(<DropdownMenu label="Workspace menu" icon={<span>⋯</span>} actions={[{ label: 'Save draft', onSelect: action }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Workspace menu' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save draft' }));
    expect(action).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
  it('closes with Escape and does not invoke disabled actions', () => {
    const action = vi.fn();
    render(<DropdownMenu label="Options" icon={<span>⋯</span>} actions={[{ label: 'Disabled', onSelect: action, disabled: true }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(screen.getByRole('menuitem', { name: 'Disabled' })).toBeDisabled();
  });
});
