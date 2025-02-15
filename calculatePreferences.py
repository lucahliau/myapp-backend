'''
#!/usr/bin/env python3
import sys
import json
import numpy as np
from sklearn.cluster import KMeans
from sentence_transformers import SentenceTransformer

model = None

def get_model(model_name="all-MiniLM-L6-v2"):
    global model
    if model is None:
        sys.stderr.write("Loading SentenceTransformer model...\n")
        model = SentenceTransformer(model_name)
    return model

def cluster_descriptions(descriptions, num_clusters=None, model_name="all-MiniLM-L6-v2"):
    if not descriptions:
        return []
    model = get_model(model_name)
    sys.stderr.write(f"Clustering {len(descriptions)} descriptions\n")
    embeddings = model.encode(descriptions)
    if num_clusters is None:
        num_clusters = min(3, len(embeddings))
    kmeans = KMeans(n_clusters=num_clusters, random_state=42)
    kmeans.fit(embeddings)
    return kmeans.cluster_centers_.tolist()

def main():
    try:
        # Read all input from stdin.
        input_data = sys.stdin.read()
        sys.stderr.write(f"Received input data: {input_data}\n")
        data = json.loads(input_data)
        liked_descriptions = data.get("likedDescriptions", [])
        disliked_descriptions = data.get("dislikedDescriptions", [])
        
        liked_centers = cluster_descriptions(liked_descriptions) if liked_descriptions else []
        disliked_centers = cluster_descriptions(disliked_descriptions) if disliked_descriptions else []
        
        output = {"likedClusters": liked_centers, "dislikedClusters": disliked_centers}
        sys.stderr.write(f"Output clusters: {output}\n")
        # Print only the final JSON to stdout.
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
'''
#!/usr/bin/env python3
import sys
import json
import numpy as np
from sklearn.cluster import KMeans
from sentence_transformers import SentenceTransformer

model = None

def get_model(model_name="all-MiniLM-L6-v2"):
    global model
    try:
        if model is None:
            sys.stderr.write("Loading SentenceTransformer model...\n")
            model = SentenceTransformer(model_name)
    except Exception as e:
        sys.stderr.write(f"Error loading model: {e}\n")
        raise
    return model

def cluster_descriptions(descriptions, num_clusters=None, model_name="all-MiniLM-L6-v2"):
    if not descriptions:
        return []
    try:
        model = get_model(model_name)
    except Exception as e:
        sys.stderr.write(f"Error obtaining model: {e}\n")
        raise
    sys.stderr.write(f"Clustering {len(descriptions)} descriptions\n")
    try:
        embeddings = model.encode(descriptions)
    except Exception as e:
        sys.stderr.write(f"Error encoding descriptions: {e}\n")
        raise
    if num_clusters is None:
        num_clusters = min(3, len(embeddings))
    try:
        kmeans = KMeans(n_clusters=num_clusters, random_state=42)
        kmeans.fit(embeddings)
        centers = kmeans.cluster_centers_.tolist()
    except Exception as e:
        sys.stderr.write(f"Error during clustering: {e}\n")
        raise
    return centers

def main():
    # Read input from stdin
    try:
        input_data = sys.stdin.read()
        if not input_data:
            sys.stderr.write("No input data received.\n")
            print(json.dumps({"error": "No input data received"}))
            sys.exit(1)
        sys.stderr.write(f"Received input data: {input_data}\n")
    except Exception as e:
        sys.stderr.write(f"Error reading input data: {e}\n")
        print(json.dumps({"error": "Error reading input data", "details": str(e)}))
        sys.exit(1)

    # Parse the JSON input
    try:
        data = json.loads(input_data)
    except Exception as e:
        sys.stderr.write(f"Error parsing JSON: {e}\n")
        print(json.dumps({"error": "Error parsing JSON", "details": str(e)}))
        sys.exit(1)

    # Extract liked and disliked descriptions
    liked_descriptions = data.get("likedDescriptions", [])
    disliked_descriptions = data.get("dislikedDescriptions", [])
    
    # Cluster the descriptions, catching errors for each set independently.
    try:
        liked_centers = cluster_descriptions(liked_descriptions) if liked_descriptions else []
    except Exception as e:
        sys.stderr.write(f"Error clustering liked descriptions: {e}\n")
        liked_centers = []
    try:
        disliked_centers = cluster_descriptions(disliked_descriptions) if disliked_descriptions else []
    except Exception as e:
        sys.stderr.write(f"Error clustering disliked descriptions: {e}\n")
        disliked_centers = []
    
    output = {"likedClusters": liked_centers, "dislikedClusters": disliked_centers}
    sys.stderr.write(f"Output clusters: {output}\n")
    
    # Convert the output to JSON and print
    try:
        result = json.dumps(output)
        print(result)
    except Exception as e:
        sys.stderr.write(f"Error converting output to JSON: {e}\n")
        print(json.dumps({"error": "Error converting output to JSON", "details": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
