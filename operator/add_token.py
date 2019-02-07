import sys
sys.path.insert(0, 'ethsnarks')
sys.path.insert(0, 'operator')
import os.path
from state import State

def main():
    state_filename = "state.json"

    state = State()
    if os.path.exists(state_filename):
        state.load(state_filename)

    state.addToken(500)

    state.save(state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
