import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CalendarEvent } from '../../types';

export const CalendarView: React.FC = () => {
  const { events, addEvent, deleteEvent } = useApp();
  const [selectedDate, setSelectedDate] = useState('2026-09-25');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Event Form State
  const [eventTitle, setEventTitle] = useState('');
  const [eventTime, setEventTime] = useState('09:00 AM');
  const [eventType, setEventType] = useState<CalendarEvent['type']>('ritual');
  const [eventDesc, setEventDesc] = useState('');

  // Calendar days generation for September 2026
  // Sept 1, 2026 is a Tuesday (index 2 if Sun=0, Mon=1)
  const daysInMonth = 30;
  const startDayOfWeek = 2; // Tuesday

  const calendarDays = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = d < 10 ? `0${d}` : `${d}`;
    calendarDays.push(`2026-09-${dayStr}`);
  }

  const selectedDateEvents = events.filter((e) => e.date === selectedDate);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    addEvent({
      title: eventTitle.trim(),
      time: eventTime,
      date: selectedDate,
      type: eventType,
      description: eventDesc.trim() || undefined,
    });
    setEventTitle('');
    setEventDesc('');
    setShowAddModal(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-light text-[#929099] tracking-wider uppercase">
            <span>Rhythms</span>
            <span>·</span>
            <span className="text-[#B8A4D8]">Gentle Schedule</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light text-[#E8E6EB] tracking-wide mt-1">
            Calendar & Rituals
          </h1>
          <p className="text-sm font-light text-[#929099] mt-1 max-w-xl">
            Mindful pacing for appointments, restorative quiet pauses, and daily rituals.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#B8A4D8] text-[#080809] hover:bg-[#c7b6e4] transition-colors text-xs font-medium flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Reminder</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Month Calendar Grid Card */}
        <div className="md:col-span-7 p-5 sm:p-6 rounded-2xl bg-[#151518] border border-[#27272B] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-normal text-[#E8E6EB]">
              September 2026
            </h2>
            <div className="flex items-center gap-1 text-xs text-[#929099]">
              <span className="px-2 py-0.5 rounded text-[11px] bg-[#101012] border border-[#27272B]">
                Autumn Rhythm
              </span>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 text-center text-[11px] font-light text-[#929099] pb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((dateStr, idx) => {
              if (!dateStr) {
                return <div key={`empty-${idx}`} className="h-10 sm:h-11" />;
              }

              const dayNumber = parseInt(dateStr.split('-')[2], 10);
              const isSelected = selectedDate === dateStr;
              const hasEvents = events.some((e) => e.date === dateStr);
              const isToday = dateStr === '2026-09-25';

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`h-10 sm:h-11 rounded-xl text-xs font-light flex flex-col items-center justify-center relative transition-all min-h-[40px] ${
                    isSelected
                      ? 'bg-[#B8A4D8] text-[#080809] font-medium shadow-sm'
                      : isToday
                      ? 'bg-[#101012] text-[#E8E6EB] border border-[#B8A4D8]/50'
                      : 'hover:bg-[#101012] text-[#E8E6EB]'
                  }`}
                >
                  <span>{dayNumber}</span>
                  {hasEvents && (
                    <span
                      className={`w-1 h-1 rounded-full mt-0.5 ${
                        isSelected ? 'bg-[#080809]' : 'bg-[#B8A4D8]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between text-[11px] text-[#929099] font-light border-t border-[#27272B]">
            <span>Selected date: {selectedDate}</span>
            <button
              onClick={() => setSelectedDate('2026-09-25')}
              className="text-[#B8A4D8] hover:underline"
            >
              Jump to Today
            </button>
          </div>
        </div>

        {/* Selected Date Agenda Card */}
        <div className="md:col-span-5 p-5 sm:p-6 rounded-2xl bg-[#151518] border border-[#27272B] space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#27272B]">
              <div>
                <span className="text-xs uppercase tracking-wider text-[#929099] font-light block">
                  Agenda for
                </span>
                <span className="text-sm font-normal text-[#E8E6EB]">
                  {selectedDate === '2026-09-25' ? 'Today (Sept 25)' : selectedDate}
                </span>
              </div>
              <span className="text-xs text-[#B8A4D8] font-light">
                {selectedDateEvents.length} rituals
              </span>
            </div>

            {/* Event List */}
            <div className="space-y-2.5 pt-3">
              {selectedDateEvents.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-[#101012] border border-[#27272B] space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-[#929099]">
                    <div className="flex items-center gap-1.5 text-[#B8A4D8]">
                      <Clock className="w-3 h-3" />
                      <span>{item.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-light">{item.type}</span>
                      <button
                        onClick={() => deleteEvent(item.id)}
                        className="p-1 rounded text-[#929099] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete reminder"
                        aria-label="Delete reminder"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <h4 className="text-xs font-normal text-[#E8E6EB]">
                    {item.title}
                  </h4>
                  {item.description && (
                    <p className="text-[11px] font-light text-[#929099] leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              ))}

              {selectedDateEvents.length === 0 && (
                <div className="py-12 text-center text-xs font-light text-[#929099] space-y-2">
                  <p>No scheduled reminders on this day.</p>
                  <p className="text-[11px] opacity-70">
                    A blank day is an invitation for quiet and rest.
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="w-full mt-4 py-2.5 rounded-xl border border-dashed border-[#27272B] hover:border-[#B8A4D8]/50 text-xs text-[#929099] hover:text-[#E8E6EB] transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <Plus className="w-3.5 h-3.5 text-[#B8A4D8]" />
            <span>Add reminder for {selectedDate}</span>
          </button>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-[#101012] border border-[#27272B] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272B]">
              <h3 className="text-sm font-normal text-[#E8E6EB]">
                Add Event or Ritual
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-[#929099] hover:text-[#E8E6EB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Lavender bath & evening reading"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50 min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-light text-[#929099] mb-1">
                    Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 07:00 PM"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-light text-[#929099] mb-1">
                    Type
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) =>
                      setEventType(e.target.value as CalendarEvent['type'])
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50 min-h-[44px]"
                  >
                    <option value="ritual">Ritual</option>
                    <option value="personal">Personal</option>
                    <option value="career">Career</option>
                    <option value="rest">Rest</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="A quiet note to yourself..."
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50 min-h-[44px]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-light text-[#929099] hover:text-[#E8E6EB] min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!eventTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-[#B8A4D8] text-[#080809] text-xs font-medium hover:bg-[#c7b6e4] transition-colors disabled:opacity-40 min-h-[44px]"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
