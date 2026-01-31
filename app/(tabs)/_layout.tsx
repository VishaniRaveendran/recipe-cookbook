import { Link, Tabs } from "expo-router";
import { Pressable } from "react-native";
import {
  BookOpen,
  BookMarked,
  List,
  User,
  Settings,
  Package,
} from "lucide-react-native";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? "light"].tint;
  const textColor = Colors[colorScheme ?? "light"].text;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tint,
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Recipes",
          tabBarIcon: ({ color }) => (
            <BookOpen size={24} color={color} style={{ marginBottom: -2 }} />
          ),
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable style={{ marginRight: 16 }}>
                <Settings size={22} color={textColor} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="cookbook"
        options={{
          title: "Cookbook",
          tabBarIcon: ({ color }) => (
            <BookMarked size={24} color={color} style={{ marginBottom: -2 }} />
          ),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: "Grocery List",
          tabBarIcon: ({ color }) => (
            <List size={24} color={color} style={{ marginBottom: -2 }} />
          ),
        }}
      />
      <Tabs.Screen
        name="fridge"
        options={{
          title: "My Kitchen",
          tabBarIcon: ({ color }) => (
            <Package size={24} color={color} style={{ marginBottom: -2 }} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <User size={24} color={color} style={{ marginBottom: -2 }} />
          ),
        }}
      />
    </Tabs>
  );
}
