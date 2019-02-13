import sys
sys.path.insert(0, 'ethsnarks')
sys.path.insert(0, 'operator')
import os.path
from state import GlobalState

def main():
    global_state_filename = "state_global.json"

    state = GlobalState()
    if os.path.exists(global_state_filename):
        state.load(global_state_filename)

    state.addToken(500)

    state.save(global_state_filename)


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
