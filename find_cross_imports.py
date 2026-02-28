
import os
import re

features_dir = r'c:\Users\agnes\Desktop\projects\tengra\src\renderer\features'
features = [d for d in os.listdir(features_dir) if os.path.isdir(os.path.join(features_dir, d))]

import_re = re.compile(r'from [\'"]@/features/([^/\'"]+)')

cross_imports = {}

for feature in features:
    feature_path = os.path.join(features_dir, feature)
    for root, dirs, files in os.walk(feature_path):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        matches = import_re.findall(content)
                        for match in matches:
                            if match != feature:
                                if match not in cross_imports:
                                    cross_imports[match] = set()
                                cross_imports[match].add(feature)
                                print(f"File {file_path} imports from {match}")
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

print("\nCross-feature import summary:")
for target, sourcers in cross_imports.items():
    print(f"Feature '{target}' is imported by: {', '.join(sourcers)}")
