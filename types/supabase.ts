export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      recipes: {
        Row: {
          id: string;
          user_id: string;
          source_url: string;
          title: string;
          image_url: string | null;
          ingredients: string[];
          steps: string[];
          created_at: string;
          cooked_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_url: string;
          title: string;
          image_url?: string | null;
          ingredients: string[];
          steps: string[];
          created_at?: string;
          cooked_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["recipes"]["Insert"]>;
      };
      grocery_lists: {
        Row: {
          id: string;
          user_id: string;
          recipe_id: string | null;
          items: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipe_id?: string | null;
          items: Json;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["grocery_lists"]["Insert"]
        >;
      };
    };
  };
}
