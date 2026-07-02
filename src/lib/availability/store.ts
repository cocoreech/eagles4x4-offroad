import type { SupabaseClient } from '@supabase/supabase-js'
import type { WeekdayHours, ShopSettings, DateOverride } from './schedule'

const ACTIVE_STATUSES = ['pending', 'confirmed', 'in_progress', 'parts_installed', 'quality_check', 'ready']
const DEFAULT_SETTINGS: ShopSettings = { slot_capacity: 3, booking_window_months: 6 }

export function createAvailabilityStore(client: SupabaseClient) {
  return {
    async loadWeekly(): Promise<WeekdayHours[]> {
      const { data, error } = await client
        .from('shop_hours')
        .select('weekday, is_open, open_hour, close_hour, lunch_start_hour, lunch_end_hour')
      if (error) throw new Error(`loadWeekly: ${error.message}`)
      return (data ?? []) as WeekdayHours[]
    },
    async loadSettings(): Promise<ShopSettings> {
      const { data, error } = await client
        .from('shop_settings')
        .select('slot_capacity, booking_window_months')
        .eq('id', 1)
        .maybeSingle()
      if (error) throw new Error(`loadSettings: ${error.message}`)
      return (data as ShopSettings | null) ?? DEFAULT_SETTINGS
    },
    async loadOverride(date: string): Promise<DateOverride | null> {
      const { data, error } = await client
        .from('availability')
        .select('is_closed, max_bookings')
        .eq('date', date)
        .maybeSingle()
      if (error) throw new Error(`loadOverride: ${error.message}`)
      return (data as DateOverride | null) ?? null
    },
    async countBookingsByHour(date: string): Promise<Record<number, number>> {
      const { data, error } = await client
        .from('bookings')
        .select('scheduled_time, status')
        .eq('scheduled_date', date)
        .in('status', ACTIVE_STATUSES)
      if (error) throw new Error(`countBookingsByHour: ${error.message}`)
      const counts: Record<number, number> = {}
      for (const b of data ?? []) {
        const h = parseInt(String(b.scheduled_time).slice(0, 2), 10)
        counts[h] = (counts[h] ?? 0) + 1
      }
      return counts
    },
  }
}
