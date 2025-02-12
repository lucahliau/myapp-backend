#!/usr/bin/env python3
import sys
import json
import numpy as np
from sklearn.cluster import KMeans
from sentence_transformers import SentenceTransformer

def cluster_descriptions(descriptions, num_clusters=None, model_name="all-MiniLM-L6-v2"):
    # Load the model
    model = SentenceTransformer(model_name)
    # Generate embeddings for the descriptions
    embeddings = model.encode(descriptions)
    # Decide on the number of clusters (if not provided, take minimum of 3 or the number of descriptions)
    if num_clusters is None:
        num_clusters = min(3, len(embeddings))
    if len(embeddings) == 0:
        return []
    # Fit KMeans and return cluster centers as lists
    kmeans = KMeans(n_clusters=num_clusters, random_state=42)
    kmeans.fit(embeddings)
    return kmeans.cluster_centers_.tolist()

def main():
    try:
        # Read all input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        liked_descriptions = data.get("liked", [])
        disliked_descriptions = data.get("disliked", [])
        liked_centers = cluster_descriptions(liked_descriptions) if liked_descriptions else []
        disliked_centers = cluster_descriptions(disliked_descriptions) if disliked_descriptions else []
        output = {"liked": liked_centers, "disliked": disliked_centers}
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
