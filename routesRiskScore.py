from flask_restful import Api, Resource, reqparse
from flask import Flask, request, jsonify
import googlemaps

# Define the new boundaries according to data
min_latitude, max_latitude = 40.49, 62.08
min_longitude, max_longitude = -74.26, -73.68

# Number of divisions along each axis to create 1,000,000 zones (1000x1000)
num_divisions = 5000

lat_step = (max_latitude - min_latitude) / num_divisions
lon_step = (max_longitude - min_longitude) / num_divisions


class GetRoutesRiskScore(Resource):

    def __init__(self, spark_session):
        self.spark = spark_session

    def get(self):
        with open("./../api_key.txt", 'r') as file:
            api_key = file.readline()

        source = request.args.get('source')
        destination = request.args.get('destination')

        # source = "UMC"
        # destination = "pearl Street"

        all_routes_data = self.get_all_routes_with_coordinates(api_key, source, destination)
        data = self.identify_routes_risk_score(all_routes_data)

        print(source, destination)

        current_path = request.path
        if current_path == '/get-routes-risk-score':
            return {
                'status': 'SUCCESS',
                'message': "GetRoutesRiskScore Api Handler",
                'routes': data
            }
        elif current_path == '/get-safest-route':
            return {
                'status': 'SUCCESS',
                'message': "GetRoutesRiskScore Api Handler",
                'route': self.find_least_risk_route(data)
            }
            # return (self.find_least_risk_route(data))

    @staticmethod
    def find_least_risk_route(routes_data):
        # Initialize variables to keep track of the least risky route
        least_risk_route = None
        min_risk_score = float('inf')

        # Iterate through each route in the data
        for route_id, route_info in routes_data.items():
            # Compare the risk score of the current route with the minimum risk score found so far
            if route_info['risk_score'] < min_risk_score:
                min_risk_score = route_info['risk_score']
                least_risk_route = route_id

        # Return the route with the least risk score
        return routes_data[least_risk_route] if least_risk_route is not None else None

    @staticmethod
    def get_all_routes_with_coordinates(api_key, origin, destination):
        # Initialize the Google Maps API client
        gmaps = googlemaps.Client(key=api_key)

        # Make the directions API request
        directions_result = gmaps.directions(origin, destination, mode="walking", alternatives=True)

        # Extract and format information about each route
        all_routes_data = {}
        for i, route in enumerate(directions_result):
            route_data = {
                "distance": route['legs'][0]['distance']['text'],
                "time": route['legs'][0]['duration']['text'],
                "route_coordinates": []
            }
            count = 0
            for step in route['legs'][0]['steps']:
                if count == 0:
                    start_location = step['start_location']
                    route_data["route_coordinates"].append({
                        "lat": start_location['lat'],
                        "long": start_location['lng']
                    })
                    count += 1
                end_location = step['end_location']
                route_data["route_coordinates"].append({
                    "lat": end_location['lat'],
                    "long": end_location['lng']
                })

            all_routes_data[str(i)] = route_data

        return all_routes_data

    def find_zone_id(self, latitude, longitude):
        # Input validation
        if not (min_latitude <= latitude <= max_latitude) or not (min_longitude <= longitude <= max_longitude):
            return "Invalid latitude or longitude"

        # Calculate indexes
        lat_index = int((latitude - min_latitude) / lat_step)
        lon_index = int((longitude - min_longitude) / lon_step)

        # Handle edge cases
        if lat_index == num_divisions:
            lat_index -= 1
        if lon_index == num_divisions:
            lon_index -= 1

        # Calculate zone_id
        zone_id = lat_index * num_divisions + lon_index
        return zone_id

    def identify_zones_for_route(self, route_coordinates):
        route_zones = []
        for coord in route_coordinates:
            zone = self.find_zone_id(coord['lat'], coord['long'])
            route_zones.append(zone)
        return route_zones

    def identify_routes_risk_score(self, all_routes_data):
        zone_risk_df = self.spark.read.option("header", "false").csv("zone_risk.csv")
        zone_risk_df = zone_risk_df.dropna()
        rows = zone_risk_df.collect()
        # Converting rows to dictionary
        zone_risk_dict = {int(row[0]): float(row[1]) for row in rows}

        route_zones_data = {}
        # Iterate through each route in the object
        for route_id, route_data in all_routes_data.items():
            route_coordinates = route_data.get("route_coordinates", [])

            # Identify zones for the route coordinates
            route_zones = self.identify_zones_for_route(route_coordinates)

            risk_count = 0
            for zone in route_zones:
                if zone in zone_risk_dict:
                    risk_count += zone_risk_dict[zone]

            t = {
                "risk_score": risk_count / len(route_coordinates),
                "distance": route_data.get("distance"),
                "time": route_data.get("time"),
                "Coordinate": route_coordinates,
            }
            route_zones_data[route_id] = t
        return route_zones_data

    def post(self):
        print(self)
        parser = reqparse.RequestParser()
        parser.add_argument('type', type=str)
        parser.add_argument('message', type=str)

        args = parser.parse_args()

        print(args)
        # note, the post req from frontend needs to match the strings here (e.g. 'type and 'message')

        request_type = args['type']
        request_json = args['message']
        # ret_status, ret_msg = ReturnData(request_type, request_json)
        # currently just returning the req straight
        ret_status = request_type
        ret_msg = request_json

        if ret_msg:
            message = "Your Message Requested: {}".format(ret_msg)
        else:
            message = "No Msg"

        final_ret = {"status": "Success", "message": message}

        return final_ret


