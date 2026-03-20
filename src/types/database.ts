export type Database = {
  public: {
    Tables: {
      credential_users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          password_hash: string;
          created_at: string;
        };
        Insert: {
          email: string;
          name?: string | null;
          password_hash: string;
        };
        Update: {
          name?: string | null;
          password_hash?: string;
        };
      };
      memory_facts: {
        Row: {
          id: string;
          user_id: string;
          key: string;
          value: string;
          category: "preference" | "todo" | "fact" | "reminder";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["memory_facts"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["memory_facts"]["Insert"]
        >;
      };
    };
  };
};
