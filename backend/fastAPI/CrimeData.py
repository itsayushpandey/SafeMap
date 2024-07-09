from http.client import HTTPException
from fastapi import FastAPI
import requests
import googlemaps

app = FastAPI()


class MyAPI:

    def __init__(self):
        self.googlemaps_api_key = 'YOUR_GOOGLEMAPS_API_KEY'
        self.spotcrime_api_key = ''

    def get_google_map_data(self, origin, destination):
        gmaps = googlemaps.Client(key=self.googlemaps_api_key)
        directions_result = gmaps.directions(origin, destination, mode="walking", alternatives=True)

        # Extract and format information about each route
        all_routes_data = []
        for route in directions_result:
            route_data = {
                "distance": route['legs'][0]['distance']['text'],
                "time": route['legs'][0]['duration']['text'],
                "route_coordinates": []
            }
            for step in route['legs'][0]['steps']:
                start_location = step['start_location']
                route_data["route_coordinates"].append({
                    "lat": start_location['lat'],
                    "long": start_location['lng']
                })
                end_location = step['end_location']
                route_data["route_coordinates"].append({
                    "lat": end_location['lat'],
                    "long": end_location['lng']
                })
            all_routes_data.append(route_data)

        return all_routes_data


    def fetch_spotcrime_data(self, latitude, longitude):
        try:
            if not latitude or not longitude:
                return "Latitude and longitude are required", 400

            # Construct URL to fetch API key
            api_url = f"https://spotcrime.com/map?lat={latitude}&lon={longitude}"
            response = requests.get(api_url)

            if response.status_code == 200:
                key = response.text.split('data-api-key=')[1].split('"')[1]
                # Make request to fetch crime data using obtained API key
                crime_data_url = f"https://spotcrime.com/crimes.json?lat={latitude}&lon={longitude}&radius=0.02"
                headers = {"spotcrime-api-token": key}
                self.spotcrime_api_key = key
                crime_data_response = requests.get(crime_data_url, headers=headers)

                if crime_data_response.status_code == 200:
                    return crime_data_response.json()
                else:
                    return "Failed to fetch crime data", crime_data_response.status_code
            else:
                return "Failed to fetch API key", response.status_code
        except Exception as e:
            return "Internal Server Error", 500


my_api = MyAPI()


@app.get("/route_and_crime_data")
async def get_route_and_crime_data(origin: str, destination: str):
    crime_data_list = []
    # Get route data from Google Maps API
    routes_data = my_api.get_google_map_data(origin, destination)

    # Extract coordinates from the first route
    if routes_data:
        coordinates = routes_data[0]["route_coordinates"]
        print("This is list of coordinates" + str(coordinates))
        print(type(coordinates))
        for idx in range(len(coordinates)):
            print("This is current" + str(coordinates[idx]))
            print(type(coordinates[idx]))
            current_coordinate = coordinates[idx]
            if current_coordinate:
                # Take the first coordinate as it starts the route
                # start_coordinate = current_coordinate[0]
                # Get crime data near the start coordinate from Spotcrime API
                spotcrime_data = my_api.fetch_spotcrime_data(current_coordinate["lat"], current_coordinate["long"])
                # "route_data": routes_data,
                crime_data_list.append(spotcrime_data)
        return {"route_data": coordinates, "spotcrime_data": crime_data_list}

    raise HTTPException(status_code=404, detail="No routes or coordinates found")
