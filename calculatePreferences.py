
#!/usr/bin/env python3
import sys
import json
import numpy as np
from sklearn.cluster import KMeans
from sentence_transformers import SentenceTransformer

# Optionally, cache the model globally so that if this script were running persistently you wouldn't reload it every time.
# (Note: For a one-off script execution, this won't persist across calls.)
model = None

def get_model(model_name="all-MiniLM-L6-v2"):
    global model
    if model is None:
        # You might want to print a log here for debugging.
        sys.stderr.write("Loading SentenceTransformer model...\n")
        model = SentenceTransformer(model_name)
    return model

def cluster_descriptions(descriptions, num_clusters=None, model_name="all-MiniLM-L6-v2"):
    if not descriptions:
        return []
    model = get_model(model_name)
    # Debug log: print number of descriptions
    sys.stderr.write(f"Clustering {len(descriptions)} descriptions\n")
    embeddings = model.encode(descriptions)
    if num_clusters is None:
        num_clusters = min(3, len(embeddings))
    kmeans = KMeans(n_clusters=num_clusters, random_state=42)
    kmeans.fit(embeddings)
    return kmeans.cluster_centers_.tolist()

def main():
    try:
        # Read all input from stdin
        input_data = sys.stdin.read()
        sys.stderr.write(f"Received input data: {input_data}\n")
        data = json.loads(input_data)
        liked_descriptions = data.get("likedDescriptions", [])
        disliked_descriptions = data.get("dislikedDescriptions", [])
        
        liked_centers = cluster_descriptions(liked_descriptions) if liked_descriptions else []
        disliked_centers = cluster_descriptions(disliked_descriptions) if disliked_descriptions else []
        
        output = {"likedClusters": liked_centers, "dislikedClusters": disliked_centers}
        # Log output for debugging
        sys.stderr.write(f"Output clusters: {output}\n")
        print(json.dumps(output))
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
