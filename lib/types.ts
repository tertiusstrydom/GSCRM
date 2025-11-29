export type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  created_at: string | null;
};

export type DealStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export type Deal = {
  id: string;
  contact_id: string;
  title: string;
  amount: number | null;
  stage: DealStage;
  close_date: string | null;
  notes: string | null;
  created_at: string | null;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  contact_id: string | null;
  created_at: string | null;
};


