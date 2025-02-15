# recommendation.py
'''
#!/usr/bin/env python3
import sys
import json
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans

def get_products_dataframe(posts, model):
    data = []
    for post in posts:
        # Use _id if available, otherwise id
        post_id = post.get('_id') or post.get('id')
        description = post.get('description', '')
        embedding = post.get('embedding', None)
        if embedding is None:
            try:
                embedding = model.encode(description).tolist()
            except Exception as e:
                sys.stderr.write(f"Error encoding description for post {post_id}: {e}\n")
                embedding = [0.0] * 384  # fallback vector (adjust dimension if needed)
        else:
            # If the embedding is provided as a string, try to convert it.
            if isinstance(embedding, str):
                try:
                    # Using json.loads instead of eval for safety if possible.
                    embedding = json.loads(embedding)
                except Exception as e:
                    sys.stderr.write(f"Error converting embedding for post {post_id}: {e}\n")
                    try:
                        embedding = model.encode(description).tolist()
                    except Exception as e2:
                        sys.stderr.write(f"Error encoding description for post {post_id}: {e2}\n")
                        embedding = [0.0] * 384
        data.append({
            "id": post_id,
            "description": description,
            "embedding": np.array(embedding)
        })
    try:
        df = pd.DataFrame(data)
    except Exception as e:
        sys.stderr.write(f"Error creating DataFrame: {e}\n")
        raise
    return df

def recommend_products(user_liked_centers, user_disliked_centers, products_df, top_n=30, dislike_weight=1.0):
    product_scores = []
    for idx, row in products_df.iterrows():
        try:
            product_embedding = row["embedding"].reshape(1, -1)
        except Exception as e:
            sys.stderr.write(f"Error reshaping embedding for row {idx}: {e}\n")
            product_scores.append(-9999)
            continue
        try:
            liked_similarities = cosine_similarity(product_embedding, user_liked_centers)
            liked_score = liked_similarities.max()
        except Exception as e:
            sys.stderr.write(f"Error computing liked similarities for row {idx}: {e}\n")
            liked_score = 0
        disliked_score = 0
        if user_disliked_centers is not None and len(user_disliked_centers) > 0:
            try:
                disliked_similarities = cosine_similarity(product_embedding, user_disliked_centers)
                disliked_score = disliked_similarities.max()
            except Exception as e:
                sys.stderr.write(f"Error computing disliked similarities for row {idx}: {e}\n")
                disliked_score = 0
        final_score = liked_score - dislike_weight * disliked_score
        product_scores.append(final_score)
    products_df["final_score"] = product_scores
    recommended = products_df.sort_values("final_score", ascending=False)
    return recommended.head(top_n)

def main():
    try:
        input_data = sys.stdin.read()
        if not input_data:
            sys.stderr.write("No input data received\n")
            print(json.dumps({"error": "No input data received"}))
            sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"Error reading input data: {e}\n")
        print(json.dumps({"error": "Error reading input data", "details": str(e)}))
        sys.exit(1)

    try:
        data = json.loads(input_data)
    except Exception as e:
        sys.stderr.write(f"Invalid JSON input: {e}\n")
        print(json.dumps({"error": "Invalid JSON input", "details": str(e)}))
        sys.exit(1)

    liked_clusters = data.get("likedClusters", [])
    disliked_clusters = data.get("dislikedClusters", [])
    posts = data.get("posts", [])
    if not liked_clusters or not posts:
        sys.stderr.write("Missing required data: likedClusters and posts are required.\n")
        print(json.dumps({"error": "Missing required data: likedClusters and posts are required."}))
        sys.exit(1)

    try:
        user_liked_centers = np.array(liked_clusters)
        user_disliked_centers = np.array(disliked_clusters) if disliked_clusters else None
    except Exception as e:
        sys.stderr.write(f"Error converting clusters to numpy arrays: {e}\n")
        print(json.dumps({"error": "Error processing clusters", "details": str(e)}))
        sys.exit(1)

    try:
        sys.stderr.write("Loading SentenceTransformer model...\n")
        model = SentenceTransformer('all-MiniLM-L6-v2')
    except Exception as e:
        sys.stderr.write(f"Error loading SentenceTransformer model: {e}\n")
        print(json.dumps({"error": "Error loading model", "details": str(e)}))
        sys.exit(1)

    try:
        products_df = get_products_dataframe(posts, model)
    except Exception as e:
        sys.stderr.write(f"Error processing posts into DataFrame: {e}\n")
        print(json.dumps({"error": "Error processing posts", "details": str(e)}))
        sys.exit(1)

    try:
        recommendations = recommend_products(
            user_liked_centers,
            user_disliked_centers,
            products_df,
            top_n=30,
            dislike_weight=1.0
        )
    except Exception as e:
        sys.stderr.write(f"Error during product recommendation: {e}\n")
        print(json.dumps({"error": "Error during recommendation", "details": str(e)}))
        sys.exit(1)

    try:
        recommendations_list = recommendations[['id', 'description', 'final_score']].to_dict(orient='records')
        print(json.dumps(recommendations_list))
    except Exception as e:
        sys.stderr.write(f"Error converting recommendations to JSON: {e}\n")
        print(json.dumps({"error": "Error preparing output", "details": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
'''
#!/usr/bin/env python3
import sys
import json
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer

def get_products_dataframe(posts, model):
    """
    Convert the list of posts (from JSON) into a DataFrame.
    If a post does not have an 'embedding', compute it using the model.
    """
    data = []
    for post in posts:
        try:
            # Get an identifier (either _id or id)
            post_id = post.get('_id') or post.get('id')
            description = post.get('description', '')
            embedding = post.get('embedding', None)
            if embedding is None:
                # Compute the embedding using the description
                embedding = model.encode(description).tolist()
            else:
                # If provided as a string, attempt to convert it
                if isinstance(embedding, str):
                    try:
                        embedding = eval(embedding)
                    except Exception as e:
                        sys.stderr.write(f"Error converting embedding for post {post_id}: {e}\n")
                        embedding = model.encode(description).tolist()
            data.append({
                "id": post_id,
                "description": description,
                "embedding": np.array(embedding)
            })
        except Exception as e:
            sys.stderr.write(f"Error processing post: {e}\n")
            continue
    return pd.DataFrame(data)

def recommend_products(user_liked_centers, user_disliked_centers, products_df, top_n=30, dislike_weight=1.0):
    """
    Compute a recommendation score for each product and return the top_n recommendations.
    """
    product_scores = []
    for idx, row in products_df.iterrows():
        try:
            product_embedding = row["embedding"].reshape(1, -1)
            liked_similarities = cosine_similarity(product_embedding, user_liked_centers)
            liked_score = liked_similarities.max()
            disliked_score = 0
            if user_disliked_centers is not None and len(user_disliked_centers) > 0:
                disliked_similarities = cosine_similarity(product_embedding, user_disliked_centers)
                disliked_score = disliked_similarities.max()
            final_score = liked_score - dislike_weight * disliked_score
            product_scores.append(final_score)
        except Exception as e:
            sys.stderr.write(f"Error scoring product at index {idx}: {e}\n")
            product_scores.append(-9999)  # Penalize if error occurs
    products_df["final_score"] = product_scores
    recommended = products_df.sort_values("final_score", ascending=False)
    return recommended.head(top_n)

def main():
    try:
        # Read the entire input from stdin
        input_data = sys.stdin.read()
        if not input_data:
            sys.stderr.write("No input data received.\n")
            print(json.dumps({"error": "No input data received"}))
            sys.stdout.flush()
            sys.exit(1)
        sys.stderr.write(f"Received input data: {input_data}\n")
    except Exception as e:
        sys.stderr.write(f"Error reading input data: {e}\n")
        print(json.dumps({"error": "Error reading input data", "details": str(e)}))
        sys.stdout.flush()
        sys.exit(1)

    try:
        data = json.loads(input_data)
    except Exception as e:
        sys.stderr.write(f"Error parsing JSON input: {e}\n")
        print(json.dumps({"error": "Error parsing JSON input", "details": str(e)}))
        sys.stdout.flush()
        sys.exit(1)
    
    # Extract required fields
    liked_clusters = data.get("likedClusters", [])
    disliked_clusters = data.get("dislikedClusters", [])
    posts = data.get("posts", [])

    if not liked_clusters or not posts:
        sys.stderr.write("Missing required data: likedClusters and posts are required.\n")
        print(json.dumps({"error": "Missing required data: likedClusters and posts are required."}))
        sys.stdout.flush()
        sys.exit(1)
    
    try:
        user_liked_centers = np.array(liked_clusters)
        user_disliked_centers = np.array(disliked_clusters) if disliked_clusters else None
    except Exception as e:
        sys.stderr.write(f"Error converting clusters to numpy arrays: {e}\n")
        print(json.dumps({"error": "Error processing clusters", "details": str(e)}))
        sys.stdout.flush()
        sys.exit(1)

    # Initialize the model
    sys.stderr.write("Initializing SentenceTransformer model...\n")
    try:
        model = SentenceTransformer('all-MiniLM-L6-v2')
    except Exception as e:
        sys.stderr.write(f"Error loading SentenceTransformer model: {e}\n")
        print(json.dumps({"error": "Error loading model", "details": str(e)}))
        sys.stdout.flush()
        sys.exit(1)
    sys.stderr.write("Model loaded successfully.\n")
    
    try:
        products_df = get_products_dataframe(posts, model)
    except Exception as e:
        sys.stderr.write(f"Error building products DataFrame: {e}\n")
        print(json.dumps({"error": "Error building products DataFrame", "details": str(e)}))
        sys.stdout.flush()
        sys.exit(1)
    
    try:
        recommendations = recommend_products(
            user_liked_centers,
            user_disliked_centers,
            products_df,
            top_n=30,
            dislike_weight=1.0
        )
    except Exception as e:
        sys.stderr.write(f"Error computing recommendations: {e}\n")
        print(json.dumps({"error": "Error computing recommendations", "details": str(e)}))
        sys.stdout.flush()
        sys.exit(1)

    try:
        recommendations_list = recommendations[['id', 'description', 'final_score']].to_dict(orient='records')
    except Exception as e:
        sys.stderr.write(f"Error preparing output: {e}\n")
        print(json.dumps({"error": "Error preparing output", "details": str(e)}))
        sys.stdout.flush()
        sys.exit(1)

    try:
        output = json.dumps(recommendations_list)
        print(output)
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"Error converting recommendations to JSON: {e}\n")
        print(json.dumps({"error": "Error converting output to JSON", "details": str(e)}))
        sys.stdout.flush()
        sys.exit(1)

if __name__ == "__main__":
    main()
