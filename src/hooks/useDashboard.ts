import { useQuery } from '@tanstack/react-query';
import {
  dashboardService, contactsService, policiesService,
} from '@api/index';

// ── All dashboard data in one place ───────────────────────────────────────────
export function useDashboardKpis() {
  return useQuery({
    queryKey:      ['dashboard', 'kpis'],
    queryFn:       dashboardService.kpis,
    staleTime:     60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useDashboardRevenue(months = 12) {
  return useQuery({
    queryKey:  ['dashboard', 'revenue', months],
    queryFn:   () => dashboardService.revenue(months),
    staleTime: 5 * 60_000,
  });
}

export function useDashboardPortfolio() {
  return useQuery({
    queryKey:  ['dashboard', 'portfolio'],
    queryFn:   dashboardService.portfolio,
    staleTime: 5 * 60_000,
  });
}

export function useDashboardDbSummary() {
  return useQuery({
    queryKey:  ['dashboard', 'db-summary'],
    queryFn:   dashboardService.dbSummary,
    staleTime: 5 * 60_000,
  });
}

export function useDashboardPipeline() {
  return useQuery({
    queryKey:  ['dashboard', 'pipeline'],
    queryFn:   dashboardService.pipeline,
    staleTime: 5 * 60_000,
  });
}

export function useDashboardClaims() {
  return useQuery({
    queryKey:  ['dashboard', 'claims'],
    queryFn:   dashboardService.claims,
    staleTime: 5 * 60_000,
  });
}

export function useDashboardEvents() {
  return useQuery({
    queryKey:      ['dashboard', 'events'],
    queryFn:       dashboardService.events,
    staleTime:     2 * 60_000,
    refetchInterval: 2 * 60_000,
  });
}

export function useUpcomingBirthdays(days = 30) {
  return useQuery({
    queryKey:  ['contacts', 'birthdays', days],
    queryFn:   () => contactsService.birthdays(days),
    staleTime: 10 * 60_000,
  });
}

export function useUpcomingRenewals(days = 30) {
  return useQuery({
    queryKey:  ['policies', 'renewals', days],
    queryFn:   () => policiesService.upcomingRenewals(days),
    staleTime: 5 * 60_000,
  });
}

export function useRecentContacts() {
  return useQuery({
    queryKey:  ['contacts', 'recent'],
    queryFn:   () => contactsService.list({ limit: 6, sortBy: 'createdAt', sortOrder: 'desc' }),
    staleTime: 2 * 60_000,
  });
}
