export interface User {
  id: string;
  email: string;
  timezone: string;
}

export interface HabitSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  totalCheckIns: number;
  currentStreak: number;
  longestStreak: number;
}

export interface CheckIn {
  id: string;
  localDate: string;
  createdAt: string;
}

export interface HabitDetail {
  habit: {
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
  };
  checkIns: CheckIn[];
  currentStreak: number;
  longestStreak: number;
  today: string;
}

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
  };
}
