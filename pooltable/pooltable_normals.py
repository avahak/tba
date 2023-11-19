import json, pickle
import numpy as np

INCH = 0.0254
DEGREE = np.pi/180.0
ANGLE_LIMIT = 60.0*DEGREE

def main():
    with open("pooltable_all_data.pkl", "rb") as f:
        data = pickle.load(f)
    print(data)

if __name__ == "__main__":
    main()