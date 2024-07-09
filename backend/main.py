import helper as hp
import pickle
import pandas as pd
from datetime import datetime
import importlib
importlib.reload(hp)

def main():
    # Get NEWS articles from Yahoo!
    news = hp.get_yahoo_news()
    # print(news)
    
    # Save NEWS title, body, date and link to csv file
    hp.save_news(news)
    
    # Load Model
    with open("VotingClassifierModel.pkl", "rb") as fid:
        model = pickle.load(fid)
    
    # Load NEWS csv file
    data = pd.read_csv(f"News_Data-{datetime.now().date()}.csv")
    
    # Process data
    data = hp.process_test_data(data, model)
    
    data.to_csv(f"News_Data-{datetime.now().date()}.csv")
    
    
main()