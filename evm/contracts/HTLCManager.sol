pragma solidity ^0.4.21;

contract HTLCManager {
    enum State {
        UNINITIATED,
        INITIATED,
        COMPLETED,
        REFUNDED
    }

    struct HTLC {
        address sender;
        address recipient;
        bytes32 H;
        uint expirationTime;
        uint value;
        State state;
    }

    event Initiated(address sender, address recipient, uint value);
    event Completed(address sender, address recipient, uint value);
    event Refunded(address sender, address recipient, uint value);

    mapping(bytes32 => HTLC) private htlcs;

    function fund(address recipient,
                  bytes32 H,
                  uint expirationTime,
                  bytes32 id) payable public {
        require(msg.value > 0, "Please send some Ether");
        require(htlcs[id].state == State.UNINITIATED, "ID already used");

        htlcs[id] = HTLC({
            sender: msg.sender,
            recipient: recipient,
            H: H,
            expirationTime: expirationTime,
            value: msg.value,
            state: State.INITIATED
        });

        emit Initiated(msg.sender, recipient, msg.value);
    }

    function claim(bytes32 id, bytes32 R) public {
        require(htlcs[id].state == State.INITIATED, "Invalid HTLC id");
        require(msg.sender == htlcs[id].recipient, "You are not the recipient");
        require(sha256(abi.encodePacked(R)) == htlcs[id].H, "Invalid preimage");
        require(now <= htlcs[id].expirationTime, "HTLC has expired");

        htlcs[id].state = State.COMPLETED;

        emit Completed(htlcs[id].sender, htlcs[id].recipient, htlcs[id].value);

        msg.sender.transfer(htlcs[id].value);
    }

    function refund(bytes32 id) public {
        require(htlcs[id].state == State.INITIATED, "Invalid HTLC id");
        require(now > htlcs[id].expirationTime, "HTLC hasn't expired yet");
        require(msg.sender == htlcs[id].sender, "You are not the HTLC creator");

        htlcs[id].state = State.REFUNDED;

        emit Refunded(htlcs[id].sender, htlcs[id].recipient, htlcs[id].value);

        msg.sender.transfer(htlcs[id].value);
    }
}
