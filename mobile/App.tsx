import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, TextInput, Button, FlatList, TouchableOpacity } from 'react-native';

const Stack = createNativeStackNavigator();
const API = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:4000';

function HomeScreen({ navigation }: any) {
  const [city, setCity] = React.useState('');
  const [items, setItems] = React.useState<any[]>([]);
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '600' }}>🎉 Celebrate</Text>
      <Text>Find venues</Text>
      <TextInput placeholder="City" value={city} onChangeText={setCity} style={{ borderWidth: 1, padding: 8, marginVertical: 8 }} />
      <Button title="Search" onPress={async () => {
        const res = await fetch(`${API}/api/venues?city=${encodeURIComponent(city)}`);
        const data = await res.json();
        setItems(data.items || []);
      }} />
      <FlatList data={items} keyExtractor={(i) => i.id} renderItem={({ item }) => (
        <TouchableOpacity onPress={() => navigation.navigate('Venue', { id: item.id })}>
          <View style={{ paddingVertical: 12 }}>
            <Text style={{ fontWeight: '600' }}>{item.name}</Text>
            <Text>{item.city}, {item.country}</Text>
          </View>
        </TouchableOpacity>
      )} />
    </View>
  );
}

function VenueScreen({ route }: any) {
  const { id } = route.params;
  const [venue, setVenue] = React.useState<any>(null);
  React.useEffect(() => { (async () => {
    const res = await fetch(`${API}/api/venues/${id}`);
    setVenue(await res.json());
  })(); }, [id]);
  if (!venue) return <View style={{ padding: 16 }}><Text>Loading…</Text></View>;
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{venue.name}</Text>
      <Text>{venue.city}, {venue.country}</Text>
      <Text style={{ marginTop: 8 }}>{venue.description}</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Venue" component={VenueScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
