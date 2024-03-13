from fastapi import FastAPI
import requests

app = FastAPI()


@app.get("/govdata")
def getdata():
    response = requests.get(
        'https://maps.boco.solutions/dataservices/sh_crimedataservice/api/crime%2F02202023%2F02202024%2FAll%2FAll%2FAll%2FAll',
        headers={'Content-Type': 'application/json',
                 'Accept': 'gzip'}).json()

    return response


@app.get('/crime')
def crimedata():
    response = requests.get(
        'https://maps.boco.solutions/dataservices/sh_crimedataservice/api/crime%2F02202023%2F02202024%2FAll%2FAll%2FAll%2FAll').json()


@app.get('/spotcrime')
def root():
    api_url = "https://spotcrime.com/crimes.json?lat=39.9252075&lon=-105.1501453&radius=0.02"
    api_key = 'SFMyNTY.g2gDbQAAADI3My4yMjkuNjIuMTI0OmZiM2E4MmI4LTM3YmMtNGYxNy1iNTBhLWVkMTg3OTk5OThmOG4GAItxSjWOAWIAAVGA.lodWh5QFw1YEzmroONAHcdkinzk2CtOlLM27nucwTdk'
    response = requests.get(api_url, headers={"spotcrime-api-token": api_key}).json()
    return response


