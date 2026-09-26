import React, { useState } from 'react';
import {
  Compass,
  Plus,
  CheckCircle2,
  Bookmark,
  Award,
  BookOpen,
  X,
} from 'lucide-react';

interface CareerProject {
  id: string;
  title: string;
  focusArea: string;
  status: 'In Flow' | 'Nurturing' | 'Completed';
  notes: string;
  milestoneDate?: string;
}

const INITIAL_PROJECTS: CareerProject[] = [
  {
    id: 'cp-1',
    title: 'Personal Creative Portfolio & Essays',
    focusArea: 'Writing & Visual Design',
    status: 'In Flow',
    notes: 'Drafting 4 long-form reflections on slow living, digital minimalism, and thoughtful craft.',
    milestoneDate: 'Autumn 2026',
  },
  {
    id: 'cp-2',
    title: 'Mastering High-Fidelity Design Systems',
    focusArea: 'Architecture & Craft',
    status: 'In Flow',
    notes: 'Studying typography math, subtle dark aesthetic palettes, and intentional whitespace.',
    milestoneDate: 'Winter 2026',
  },
  {
    id: 'cp-3',
    title: 'Quiet Mentorship & Knowledge Sharing',
    focusArea: 'Community & Care',
    status: 'Nurturing',
    notes: 'Supporting junior designers and writers with kind, constructive guidance.',
    milestoneDate: 'Ongoing',
  },
];

export const CareerView: React.FC = () => {
  const [projects, setProjects] = useState<CareerProject[]>(() => {
    try {
      const saved = localStorage.getItem('mlw_career_projects');
      return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
    } catch {
      return INITIAL_PROJECTS;
    }
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [notes, setNotes] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('This Season');

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const newProj: CareerProject = {
      id: `cp-${Date.now()}`,
      title: title.trim(),
      focusArea: focusArea.trim() || 'Creative Craft',
      status: 'In Flow',
      notes: notes.trim() || 'Nurturing meaningful progress at a healthy pace.',
      milestoneDate,
    };
    const updated = [newProj, ...projects];
    setProjects(updated);
    try {
      localStorage.setItem('mlw_career_projects', JSON.stringify(updated));
    } catch (err) {
      console.warn('Storage failed', err);
    }
    setTitle('');
    setFocusArea('');
    setNotes('');
    setShowAddModal(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-light text-[#929099] tracking-wider uppercase">
            <span>Vocation</span>
            <span>·</span>
            <span className="text-[#B8A4D8]">Mindful Path</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light text-[#E8E6EB] tracking-wide mt-1">
            Career & Calling
          </h1>
          <p className="text-sm font-light text-[#929099] mt-1 max-w-xl">
            Cultivating meaningful work with intention, patience, and personal grace.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#B8A4D8] text-[#080809] hover:bg-[#c7b6e4] transition-colors text-xs font-medium flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Craft Project</span>
        </button>
      </div>

      {/* Gentle Philosophy Banner */}
      <div className="p-5 rounded-2xl bg-[#101012] border border-[#27272B] flex items-start gap-3.5">
        <div className="w-8 h-8 rounded-xl bg-[#151518] border border-[#27272B] flex items-center justify-center text-[#B8A4D8] shrink-0 mt-0.5">
          <Compass className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xs font-normal text-[#E8E6EB] uppercase tracking-wider">
            Quiet Ambition
          </h3>
          <p className="text-xs font-light text-[#929099] leading-relaxed">
            True excellence does not require frantic urgency. High standards can live side-by-side with peace of mind and healthy boundaries.
          </p>
        </div>
      </div>

      {/* Current Projects & Focus Areas */}
      <div className="space-y-4">
        <h2 className="text-sm font-normal text-[#E8E6EB] tracking-wide">
          Current Focus & Milestones
        </h2>

        <div className="grid grid-cols-1 gap-3.5">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="p-5 rounded-2xl bg-[#151518] border border-[#27272B] hover:border-[#B8A4D8]/30 transition-all space-y-2.5"
            >
              <div className="flex items-center justify-between text-xs text-[#929099]">
                <div className="flex items-center gap-2">
                  <span className="text-[#B8A4D8]">{proj.focusArea}</span>
                  <span>·</span>
                  <span className="font-light">{proj.status}</span>
                </div>
                {proj.milestoneDate && (
                  <span className="font-light">{proj.milestoneDate}</span>
                )}
              </div>

              <h3 className="text-sm font-normal text-[#E8E6EB]">
                {proj.title}
              </h3>

              <p className="text-xs font-light text-[#929099] leading-relaxed">
                {proj.notes}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Proud Moments & Quiet Wins */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#151518] border border-[#27272B] space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-[#B8A4D8]" />
          <h2 className="text-sm font-normal text-[#E8E6EB] tracking-wide">
            Quiet Wins to Remember
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-light text-[#929099]">
          <div className="p-3.5 rounded-xl bg-[#101012] border border-[#27272B] space-y-1">
            <span className="text-[#E8E6EB] block font-normal">
              Maintained Peaceful Work Boundaries
            </span>
            <span>Refused unnecessary weekend urgency, preserving evenings for quiet reading.</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#101012] border border-[#27272B] space-y-1">
            <span className="text-[#E8E6EB] block font-normal">
              Completed First Clean Design System
            </span>
            <span>Built with accessible contrasts, light typography, and no generic visual slop.</span>
          </div>
        </div>
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-[#101012] border border-[#27272B] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272B]">
              <h3 className="text-sm font-normal text-[#E8E6EB]">
                New Career Focus
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-[#929099] hover:text-[#E8E6EB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-3.5">
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Project Title
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Master creative typography"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Focus Area
                </label>
                <input
                  type="text"
                  placeholder="e.g. Design, Writing, Leadership"
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Reflections & Next Step
                </label>
                <textarea
                  rows={3}
                  placeholder="Notes on why this matters to you..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50 font-light resize-none"
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
                  disabled={!title.trim()}
                  className="px-5 py-2 rounded-xl bg-[#B8A4D8] text-[#080809] text-xs font-medium hover:bg-[#c7b6e4] transition-colors disabled:opacity-40 min-h-[44px]"
                >
                  Save Focus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
