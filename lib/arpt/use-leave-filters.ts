'use client';

import { create } from 'zustand';

type LeaveFiltersState = {
  status: 'all' | 'submitted' | 'approved' | 'rejected';
  setStatus: (status: LeaveFiltersState['status']) => void;
};

export const useLeaveFilters = create<LeaveFiltersState>((set) => ({
  status: 'all',
  setStatus: (status) => set({ status }),
}));
