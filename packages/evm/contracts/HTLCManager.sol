pragma solidity ^0.4.21;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

contract HTLCManager {
  using SafeMath for uint;

  enum State {UNINITIATED, INITIATED, COMPLETED, REFUNDED}

  struct HTLC {
    address sender;
    address recipient;
    bytes32 H;
    uint expirationTime;
    uint value;
    State state;
  }

  event Initiated(
    bytes32 id,
    address indexed sender,
    address indexed recipient,
    uint value,
    uint timeWindow,
    bytes32 H
  );
  event Completed(
    bytes32 indexed id,
    address sender,
    address recipient,
    uint value,
    bytes32 R
  );
  event Refunded(
    bytes32 indexed id,
    address sender,
    address recipient,
    uint value
  );

  mapping(bytes32 => HTLC) private htlcs;

  function fund(
    address recipient,
    bytes32 H,
    uint timeWindow,
    bytes32 id
  ) public payable {
    require(msg.value > 0, "No Ether sent");
    require(htlcs[id].state == State.UNINITIATED, "ID already used");

    htlcs[id] = HTLC({
      sender: msg.sender,
      recipient: recipient,
      H: H,
      expirationTime: now.add(timeWindow),
      value: msg.value,
      state: State.INITIATED
    });

    emit Initiated(
      id,
      msg.sender,
      recipient,
      msg.value,
      timeWindow,
      H
    );
  }

  function claim(bytes32 id, bytes32 R) public {
    require(htlcs[id].state == State.INITIATED, "Invalid HTLC id");
    require(msg.sender == htlcs[id].recipient, "You are not the recipient");
    require(sha256(abi.encodePacked(R)) == htlcs[id].H, "Invalid preimage");
    require(now < htlcs[id].expirationTime, "HTLC has expired");

    htlcs[id].state = State.COMPLETED;

    emit Completed(
      id,
      htlcs[id].sender,
      htlcs[id].recipient,
      htlcs[id].value,
      R
    );

    msg.sender.transfer(htlcs[id].value);
  }

  function refund(bytes32 id) public {
    require(htlcs[id].state == State.INITIATED, "Invalid HTLC id");
    require(now >= htlcs[id].expirationTime, "HTLC hasn't expired yet");
    require(msg.sender == htlcs[id].sender, "You are not the HTLC creator");

    htlcs[id].state = State.REFUNDED;

    emit Refunded(id, htlcs[id].sender, htlcs[id].recipient, htlcs[id].value);

    msg.sender.transfer(htlcs[id].value);
  }
}
