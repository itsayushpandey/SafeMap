import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from bs4 import BeautifulSoup
import json
import pandas as pd
import re
import nltk
from nltk.corpus import stopwords
from sklearn.feature_extraction.text import TfidfVectorizer
import spacy
from geopy.geocoders import Nominatim
from tqdm import tqdm
tqdm.pandas()
nltk.download('punkt')
nltk.download('stopwords')
import pickle
from pymongo import MongoClient
import os
from dotenv import load_dotenv, dotenv_values
load_dotenv()


def get_article_content(url):
    try:
        response = requests.get(url)
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            article_content = soup.find('article')
            if article_content:
                return article_content.text.strip()
            else:
                return "No content found"
        
        else:
            print("Failed to fetch article content. Status code: ", response.status_code)
            return None
    
    except Exception as e:
        print("An error occurred whiile fetching NEWS article: ", str(e))
        return None


def get_yahoo_news():
    url = "https://news.yahoo.com/rss/"
    
    try:
        response = requests.get(url)
        
        if response.status_code == 200:
            root = ET.fromstring(response.content)
            
            today = datetime.now().strftime('%Y-%m-%d')
            
            news_data = []
            for item in root.findall('.//item'):
                title = item.find('title').text
                link = item.find('link').text
                pub_date = item.find('pubDate').text
                
                if pub_date.startswith(today):
                    article_content = get_article_content(link)
                    # print(article_content)
                    news_data.append({
                        'pub_date': pub_date,
                        'link': link,
                        'title': title,
                        'body': article_content
                    })
            
            return news_data
        else:
            print("Falied to fetch data from Yahoo! News. Status Code: ", response.status_code)
            return None
    
    except Exception as e:
        print("An error occurred: ", str(e))
        return None

def save_news(news):
    json_crime_data = json.dumps(news)
    json_crime_data = json.loads(json_crime_data)
    df = pd.DataFrame(json_crime_data)
    df.to_csv(f"News_Data-{datetime.now().date()}.csv", index=False)

def perform_ner(text):
    nlp = spacy.load('en_core_web_sm')
    doc = nlp(text)
    entities = [(ent.text, ent.label_) for ent in doc.ents]
    return entities


def geocode_locations(location_names):
    geolocator = Nominatim(user_agent="crime_geocoder")
    coordinates = []
    for location_name in location_names:
        try:
            location = geolocator.geocode(location_name)
            if location:
                coordinates.append((location.latitude, location.longitude))
        except Exception as e:
            print(f"Error geocoding {location_name}: {e}")

    return coordinates

def clean_text(text):
    text = re.sub(r'[^a-zA-Z\s]', '', text)
    text = text.lower()
    stop_words = set(stopwords.words('english'))
    words = nltk.word_tokenize(text)
    filtered_words = [word for word in words if word not in stop_words]
    clean_text = ' '.join(filtered_words)
    return clean_text

def get_entities(clean_text):
    entities = perform_ner(clean_text)
    entities = [entity for entity in entities if (entity[1] == "GPE" or entity[1] == "LOC")]
    return list(set(entities))

def get_coordinates(entities):
    # print(type(location_entities), location_entities)
    locations = [entity[0] for entity in entities]
    # print(locations)
    coordinates = geocode_locations(locations)
    return coordinates

def process_test_data(data, model):
    data['combined_text'] = data['title'].astype(str).apply(clean_text) + ' ' + data['body'].astype(str).apply(clean_text)

    vectorizer = TfidfVectorizer(vocabulary=pickle.load(open("tfidf_vocab.pkl", "rb")))
    X = vectorizer.fit_transform(data['combined_text'])
    data['prediction'] = model.predict(X)
    data = data[data['prediction'] != 0]

    data['entities'] = data['combined_text'].apply(get_entities)
    data['coordinates'] = data['entities'].progress_apply(get_coordinates)

    return data

def parse_data_to_json(data):
    json_data = data.to_json(orient="records", lines=False)
    parsed_json = json.loads(json_data)
    return parsed_json

def send_to_mongo(json_data):
    client = MongoClient(os.getenv("MONGO_STRING"))
    db = client["safemap"]
    collection = db["news"]
    try:
        for item in json_data:
            collection.insert_one({
                "pub_date": item["pub_date"],
                "link": item["link"],
                "title": item["title"],
                "coordinates": item["coordinates"]
            })
        collection.insert_many(json_data)
        return True
    except Exception as e:
        print("An error occurred: ", str(e))
        return False