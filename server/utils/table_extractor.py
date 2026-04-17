import pdfplumber
import json
import sys
import os

def extract_tables(pdf_path):
    try:
        results = []
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                tables = page.extract_tables()
                if tables:
                    for table_idx, table in enumerate(tables):
                        # Clean up the table (remove None values and empty rows)
                        cleaned_table = []
                        for row in table:
                            if any(cell for cell in row if cell is not None and cell.strip()):
                                cleaned_table.append([cell.strip() if cell else "" for cell in row])
                        
                        if cleaned_table:
                            results.append({
                                "page": i + 1,
                                "table_index": table_idx,
                                "data": cleaned_table
                            })
        
        return results
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No PDF path provided"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)
        
    extracted_data = extract_tables(pdf_path)
    print(json.dumps(extracted_data))
