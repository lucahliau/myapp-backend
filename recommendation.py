# recommendation.py
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
        # Try to get an identifier; use '_id' or 'id'
        post_id = post.get('_id') or post.get('id')
        description = post.get('description', '')
        embedding = post.get('embedding', None)
        if embedding is None:
            # Compute the embedding for the description if not provided.
            embedding = model.encode(description).tolist()
        else:
            # If the embedding is provided as a string (or in another format), try to convert it.
            if isinstance(embedding, str):
                try:
                    embedding = eval(embedding)
                except Exception as e:
                    # If conversion fails, compute the embedding.
                    embedding = model.encode(description).tolist()
        data.append({
            "id": post_id,
            "description": description,
            "embedding": np.array(embedding)
        })
    return pd.DataFrame(data)

def recommend_products(user_liked_centers, user_disliked_centers, products_df, top_n=30, dislike_weight=1.0):
    """
    Compute a recommendation score for each product and return the top_n recommendations.
    
    user_liked_centers: numpy array of shape (num_clusters, embedding_dim)
    user_disliked_centers: numpy array of shape (num_clusters, embedding_dim) or None
    products_df: DataFrame containing an 'embedding' column (each a numpy array)
    """
    product_scores = []
    
    # Iterate over each product/post.
    for idx, row in products_df.iterrows():
        product_embedding = row["embedding"].reshape(1, -1)
        
        # Compute similarity with liked clusters.
        liked_similarities = cosine_similarity(product_embedding, user_liked_centers)
        liked_score = liked_similarities.max()
        
        # Compute similarity with disliked clusters if available.
        disliked_score = 0
        if user_disliked_centers is not None and len(user_disliked_centers) > 0:
            disliked_similarities = cosine_similarity(product_embedding, user_disliked_centers)
            disliked_score = disliked_similarities.max()
        
        # The final score subtracts a weighted disliked similarity.
        final_score = liked_score - dislike_weight * disliked_score
        product_scores.append(final_score)
    
    products_df["final_score"] = product_scores
    recommended = products_df.sort_values("final_score", ascending=False)
    return recommended.head(top_n)

def main():
    # Read JSON input from stdin.
    input_data = sys.stdin.read()
    if not input_data:
        print(json.dumps({"error": "No input data received"}))
        sys.exit(1)
    
    try:
        data = json.loads(input_data)
    except Exception as e:
        print(json.dumps({"error": "Invalid JSON input", "details": str(e)}))
        sys.exit(1)
    
    # Extract the clusters and posts from the input.
    liked_clusters = data.get("likedClusters", [])
    disliked_clusters = data.get("dislikedClusters", [])
    posts = data.get("posts", [])
    
    if not liked_clusters or not posts:
        print(json.dumps({"error": "Missing required data: likedClusters and posts are required."}))
        sys.exit(1)
    
    # Convert clusters to numpy arrays.
    user_liked_centers = np.array(liked_clusters)
    user_disliked_centers = np.array(disliked_clusters) if disliked_clusters else None

    # Initialize the sentence transformer model (adjust model name if needed).
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # Build a DataFrame from the posts.
    products_df = get_products_dataframe(posts, model)
    
    # Get the top recommendations.
    recommendations = recommend_products(
        user_liked_centers,
        user_disliked_centers,
        products_df,
        top_n=30,        # You can adjust this to 30 or any other number.
        dislike_weight=1.0
    )
    
    # Prepare output: convert the recommendations DataFrame to a list of dictionaries.
    recommendations_list = recommendations[['id', 'description', 'final_score']].to_dict(orient='records')
    
    # Output the JSON result.
    print(json.dumps(recommendations_list))

if __name__ == "__main__":
    main()
