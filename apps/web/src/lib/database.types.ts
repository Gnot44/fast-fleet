export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          agenda: string | null
          appointment_type: string | null
          arrived_at: string | null
          check_in_at: string | null
          check_out_at: string | null
          client_photo_url: string | null
          company_name: string
          completed_at: string | null
          confirmation_status: boolean | null
          created_at: string
          customer_name: string
          destination_address: string | null
          destination_lat: number | null
          destination_lng: number | null
          distance_km: number | null
          driver_notes: string | null
          end_odometer: number | null
          id: string
          items_description: string | null
          meeting_notes: string | null
          meeting_notes_updated_at: string | null
          name: string | null
          odometer_reading: number | null
          recipient_name: string | null
          recipient_phone: string | null
          scheduled_at: string | null
          sequence_order: number | null
          staff_id: string
          start_odometer: number | null
          started_at: string | null
          status: string
          tenant_id: string | null
          trip_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          appointment_type?: string | null
          arrived_at?: string | null
          check_in_at?: string | null
          check_out_at?: string | null
          client_photo_url?: string | null
          company_name: string
          completed_at?: string | null
          confirmation_status?: boolean | null
          created_at?: string
          customer_name: string
          destination_address?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_notes?: string | null
          end_odometer?: number | null
          id?: string
          items_description?: string | null
          meeting_notes?: string | null
          meeting_notes_updated_at?: string | null
          name?: string | null
          odometer_reading?: number | null
          recipient_name?: string | null
          recipient_phone?: string | null
          scheduled_at?: string | null
          sequence_order?: number | null
          staff_id: string
          start_odometer?: number | null
          started_at?: string | null
          status?: string
          tenant_id?: string | null
          trip_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          appointment_type?: string | null
          arrived_at?: string | null
          check_in_at?: string | null
          check_out_at?: string | null
          client_photo_url?: string | null
          company_name?: string
          completed_at?: string | null
          confirmation_status?: boolean | null
          created_at?: string
          customer_name?: string
          destination_address?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_notes?: string | null
          end_odometer?: number | null
          id?: string
          items_description?: string | null
          meeting_notes?: string | null
          meeting_notes_updated_at?: string | null
          name?: string | null
          odometer_reading?: number | null
          recipient_name?: string | null
          recipient_phone?: string | null
          scheduled_at?: string | null
          sequence_order?: number | null
          staff_id?: string
          start_odometer?: number | null
          started_at?: string | null
          status?: string
          tenant_id?: string | null
          trip_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_logs: {
        Row: {
          consent_given: boolean
          created_at: string
          id: string
          ip_address: unknown
          profile_id: string
          user_agent: string | null
        }
        Insert: {
          consent_given: boolean
          created_at?: string
          id?: string
          ip_address?: unknown
          profile_id: string
          user_agent?: string | null
        }
        Update: {
          consent_given?: boolean
          created_at?: string
          id?: string
          ip_address?: unknown
          profile_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          appointment_id: string
          category: string
          created_at: string
          id: string
          notes: string | null
          payment_method: string | null
          receipt_image_path: string | null
          receipt_url: string | null
          staff_id: string
          status: string | null
          title: string | null
          trip_id: string | null
        }
        Insert: {
          amount: number
          appointment_id: string
          category: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_image_path?: string | null
          receipt_url?: string | null
          staff_id: string
          status?: string | null
          title?: string | null
          trip_id?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_image_path?: string | null
          receipt_url?: string | null
          staff_id?: string
          status?: string | null
          title?: string | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      location_logs: {
        Row: {
          accuracy: number | null
          altitude: number | null
          appointment_id: string | null
          battery_level: number | null
          created_at: string
          heading: number | null
          id: string
          is_mock_location: boolean | null
          lat: number
          lng: number
          speed: number | null
          staff_id: string
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          appointment_id?: string | null
          battery_level?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          is_mock_location?: boolean | null
          lat: number
          lng: number
          speed?: number | null
          staff_id: string
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          appointment_id?: string | null
          battery_level?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          is_mock_location?: boolean | null
          lat?: number
          lng?: number
          speed?: number | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          nickname: string | null
          phone: string | null
          push_token: string | null
          role: string
          status: string
          timezone: string | null
          two_factor_enabled: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id: string
          nickname?: string | null
          phone?: string | null
          push_token?: string | null
          role?: string
          status?: string
          timezone?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          nickname?: string | null
          phone?: string | null
          push_token?: string | null
          role?: string
          status?: string
          timezone?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          assigned_vehicle: string | null
          created_at: string
          current_location: string | null
          department: string | null
          emergency_contact: string | null
          id: string
          on_time_percentage: number | null
          on_time_rate: number | null
          profile_id: string
          rating: number | null
          safety_score: number | null
          staff_id: string | null
          territory: string | null
          total_distance_km: number | null
          total_trips: number | null
          updated_at: string
        }
        Insert: {
          assigned_vehicle?: string | null
          created_at?: string
          current_location?: string | null
          department?: string | null
          emergency_contact?: string | null
          id?: string
          on_time_percentage?: number | null
          on_time_rate?: number | null
          profile_id: string
          rating?: number | null
          safety_score?: number | null
          staff_id?: string | null
          territory?: string | null
          total_distance_km?: number | null
          total_trips?: number | null
          updated_at?: string
        }
        Update: {
          assigned_vehicle?: string | null
          created_at?: string
          current_location?: string | null
          department?: string | null
          emergency_contact?: string | null
          id?: string
          on_time_percentage?: number | null
          on_time_rate?: number | null
          profile_id?: string
          rating?: number | null
          safety_score?: number | null
          staff_id?: string | null
          territory?: string | null
          total_distance_km?: number | null
          total_trips?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          auto_dispatch: boolean | null
          company_name: string | null
          currency: string | null
          excessive_idle_minutes: number | null
          geofence_opacity: number | null
          gps_ping_interval_sec: number | null
          id: string
          map_defaults: Json | null
          max_speed_limit: number | null
          notifications_config: Json | null
          tenant_id: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          auto_dispatch?: boolean | null
          company_name?: string | null
          currency?: string | null
          excessive_idle_minutes?: number | null
          geofence_opacity?: number | null
          gps_ping_interval_sec?: number | null
          id?: string
          map_defaults?: Json | null
          max_speed_limit?: number | null
          notifications_config?: Json | null
          tenant_id?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_dispatch?: boolean | null
          company_name?: string | null
          currency?: string | null
          excessive_idle_minutes?: number | null
          geofence_opacity?: number | null
          gps_ping_interval_sec?: number | null
          id?: string
          map_defaults?: Json | null
          max_speed_limit?: number | null
          notifications_config?: Json | null
          tenant_id?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trips: {
        Row: {
          actual_start_location: Json | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          assigned_vehicle: string | null
          completed_at: string | null
          created_at: string | null
          current_odometer: number | null
          end_odometer: number | null
          id: string
          manager_feedback: string | null
          safety_score: number | null
          staff_id: string
          start_location: Json | null
          start_odometer: number | null
          started_at: string | null
          status: string
          submitted_at: string | null
          tenant_id: string | null
          title: string
          total_distance_km: number | null
          total_expenses: number | null
          trip_code: string | null
          trip_date: string
          type: string
          updated_at: string | null
        }
        Insert: {
          actual_start_location?: Json | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_vehicle?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_odometer?: number | null
          end_odometer?: number | null
          id?: string
          manager_feedback?: string | null
          safety_score?: number | null
          staff_id: string
          start_location?: Json | null
          start_odometer?: number | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id?: string | null
          title: string
          total_distance_km?: number | null
          total_expenses?: number | null
          trip_code?: string | null
          trip_date?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          actual_start_location?: Json | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_vehicle?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_odometer?: number | null
          end_odometer?: number | null
          id?: string
          manager_feedback?: string | null
          safety_score?: number | null
          staff_id?: string
          start_location?: Json | null
          start_odometer?: number | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id?: string | null
          title?: string
          total_distance_km?: number | null
          total_expenses?: number | null
          trip_code?: string | null
          trip_date?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
