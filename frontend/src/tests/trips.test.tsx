import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { StatusBadge, VisibilityBadge, CategoryBadge } from '../components/trips/TripBadge';
import { TripCard } from '../components/trips/TripCard';
import { JourneyTimeline } from '../components/trips/JourneyTimeline';
import { StopModal } from '../components/trips/StopModal';
import { TripEditorModal } from '../components/trips/TripEditorModal';
import { Trip, TripStop } from '../types/trip';

const mockTrip: Trip = {
  id: 'trip-uuid-1',
  owner_id: 'user-uuid-1',
  title: 'Kumano Kodo Pilgrimage',
  description: 'Ancient mountain trail through the sacred Kii Peninsula.',
  starting_location: 'Tanabe',
  ending_location: 'Nachi Falls',
  start_date: '2026-05-01',
  end_date: '2026-05-06',
  category: 'Trekking',
  visibility: 'public',
  status: 'published',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  owner: {
    id: 'user-uuid-1',
    username: 'kenji.hikers',
    display_name: 'Kenji Sato',
    avatar_url: null,
  },
  stops_count: 2,
  stops: [
    {
      id: 'stop-uuid-1',
      trip_id: 'trip-uuid-1',
      stop_name: 'Takahara Village',
      location: 'Nakahechi Trail',
      latitude: 33.7833,
      longitude: 135.5333,
      arrival_date: '2026-05-01',
      departure_date: '2026-05-02',
      accommodation_details: 'Kiri-no-Sato Lodge',
      activities: 'Sunset valley overlook',
      notes: 'Pack hiking poles',
      order_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'stop-uuid-2',
      trip_id: 'trip-uuid-1',
      stop_name: 'Tsugizakura-oji',
      location: 'Nonaka',
      latitude: 33.8167,
      longitude: 135.6167,
      arrival_date: '2026-05-02',
      departure_date: '2026-05-03',
      order_index: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
};

const renderWithTheme = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <BrowserRouter>{ui}</BrowserRouter>
    </ThemeProvider>
  );
};

describe('Trip Management Frontend Components & Design System Suite', () => {
  it('renders StatusBadge and VisibilityBadge variants accurately', () => {
    const { rerender } = renderWithTheme(<StatusBadge status="draft" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <BrowserRouter>
          <StatusBadge status="published" />
        </BrowserRouter>
      </ThemeProvider>
    );
    expect(screen.getByText('Published')).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <BrowserRouter>
          <StatusBadge status="archived" />
        </BrowserRouter>
      </ThemeProvider>
    );
    expect(screen.getByText('Archived')).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <BrowserRouter>
          <VisibilityBadge visibility="public" />
        </BrowserRouter>
      </ThemeProvider>
    );
    expect(screen.getByText('Public')).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <BrowserRouter>
          <VisibilityBadge visibility="private" />
        </BrowserRouter>
      </ThemeProvider>
    );
    expect(screen.getByText('Private')).toBeInTheDocument();
  });

  it('renders TripCard with title, route flow, category badge, and stop count', () => {
    renderWithTheme(<TripCard trip={mockTrip} isOwner={true} />);

    expect(screen.getByText('Kumano Kodo Pilgrimage')).toBeInTheDocument();
    expect(screen.getByText('Tanabe')).toBeInTheDocument();
    expect(screen.getByText('Nachi Falls')).toBeInTheDocument();
    expect(screen.getByText('Trekking')).toBeInTheDocument();
    expect(screen.getByText('2 stops')).toBeInTheDocument();
    expect(screen.getByText('Kenji Sato')).toBeInTheDocument();
  });

  it('renders JourneyTimeline distinguishing Starting location, Intermediate stops, and Final destination', () => {
    renderWithTheme(
      <JourneyTimeline
        startingLocation={mockTrip.starting_location}
        endingLocation={mockTrip.ending_location}
        stops={mockTrip.stops}
        isOwner={true}
      />
    );

    // Starting location
    expect(screen.getByText('Journey Starting Point')).toBeInTheDocument();
    expect(screen.getByText('Tanabe')).toBeInTheDocument();

    // Intermediate stops in sequence
    expect(screen.getByText('Stop #1')).toBeInTheDocument();
    expect(screen.getByText('Takahara Village')).toBeInTheDocument();
    expect(screen.getByText('Kiri-no-Sato Lodge')).toBeInTheDocument();

    expect(screen.getByText('Stop #2')).toBeInTheDocument();
    expect(screen.getByText('Tsugizakura-oji')).toBeInTheDocument();

    // Final destination
    expect(screen.getByText('Final Destination')).toBeInTheDocument();
    expect(screen.getByText('Nachi Falls')).toBeInTheDocument();
  });

  it('triggers onMoveUp and onMoveDown callbacks in JourneyTimeline', () => {
    const handleMoveUp = vi.fn();
    const handleMoveDown = vi.fn();

    renderWithTheme(
      <JourneyTimeline
        startingLocation={mockTrip.starting_location}
        endingLocation={mockTrip.ending_location}
        stops={mockTrip.stops}
        isOwner={true}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
      />
    );

    // Stop #2 has move up enabled
    const moveUpButtons = screen.getAllByTitle('Move stop earlier in journey');
    fireEvent.click(moveUpButtons[1]); // Stop #2 move up
    expect(handleMoveUp).toHaveBeenCalledWith(1);

    // Stop #1 has move down enabled
    const moveDownButtons = screen.getAllByTitle('Move stop later in journey');
    fireEvent.click(moveDownButtons[0]); // Stop #1 move down
    expect(handleMoveDown).toHaveBeenCalledWith(0);
  });

  it('validates required fields and coordinate boundaries in StopModal', async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();

    renderWithTheme(
      <StopModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    // Attempt submit with empty form
    fireEvent.click(screen.getByRole('button', { name: /add stop/i }));

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/stop name must be at least 2 characters/i)).toBeInTheDocument();

    // Fill valid name, valid location, but invalid latitude > 90
    fireEvent.change(screen.getByPlaceholderText('e.g. Takahara Village'), {
      target: { value: 'Valid Waypoint' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. Nonaka, Wakayama'), {
      target: { value: 'Valid Location' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 33.7833'), {
      target: { value: '95.5' }, // Out of range
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 135.5333'), {
      target: { value: '135.5' },
    });

    fireEvent.click(screen.getByRole('button', { name: /add stop/i }));
    expect(screen.getByText(/latitude must be a valid number between -90.0 and 90.0/i)).toBeInTheDocument();
  });

  it('validates trip dates in TripEditorModal', async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();

    renderWithTheme(
      <TripEditorModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. Trans-Himalayan High Passes'), {
      target: { value: 'Zanskar Expedition' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. Leh, Ladakh'), {
      target: { value: 'Leh' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. Manali, Himachal Pradesh'), {
      target: { value: 'Manali' },
    });

    // Inverted dates: end_date < start_date
    const dateInputs = screen.getAllByDisplayValue('');
    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);

    fireEvent.change(startDateInput, { target: { value: '2026-08-10' } });
    fireEvent.change(endDateInput, { target: { value: '2026-08-05' } });

    fireEvent.click(screen.getByRole('button', { name: /create draft/i }));
    expect(screen.getByText(/end date cannot be earlier than start date/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
