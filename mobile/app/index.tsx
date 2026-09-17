import { Redirect } from "expo-router";

/** Entry: the app opens on the Home tab. (A sign-in gate would go here later.) */
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
