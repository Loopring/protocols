
// This code is taken from https://github.com/OpenZeppelin/openzeppelin-labs
// with minor modifications.

pragma solidity 0.5.10;

import '../thirdparty/OwnedUpgradeabilityProxy.sol';

/**
 * @title OwnedScheduleUpgradabilityProxy
 */
contract OwnedScheduleUpgradabilityProxy is OwnedUpgradeabilityProxy {

	event UpgradeScheduled(uint timestamp, address _implementation);
	event UpgradeCancelled(uint timestamp);

	// Storage position of the owner of the contract
	bytes32 private constant minWaitingPeriodPos = keccak256("org.loopring.proxy.scheduled.min.waiting.period");
	bytes32 private constant scheduledImplementationPos = keccak256("org.loopring.proxy.scheduled.implementation");
	bytes32 private constant scheduledTimestampPos = keccak256("org.loopring.proxy.scheduled.timestamp");

	constructor(
		uint minWaitingPeriod
		)
		public
		OwnedUpgradeabilityProxy()
	{
		setMinWaitingPeriod(minWaitingPeriod);
	}

	function scheduleUpgrade(
		uint 	_timestamp,
		address _implementation
		)
		public
		onlyProxyOwner
	{
		require(_timestamp >= now + minWaitingPeriod(), "INVALID_TIMESTAMP");
		require(_implementation != address(0), "ZERO_ADDRESS");
		require(_implementation != implementation(), "SAME_ADDRESS");

		setScheduledTimestamp(_timestamp);
		setScheduledImplementation(_implementation);
		emit UpgradeScheduled(_timestamp, _implementation);
	}

	function cancelScheduledUpgrade()
		public
		onlyProxyOwner
	{
		require(scheduledImplementation() != address(0), "NOTHING_SCHEDULED");

		setScheduledTimestamp(0);
		setScheduledImplementation(address(0));
		emit UpgradeCancelled(now);
	}

	function minWaitingPeriod()
		public
		view
		returns (uint _minWaitingPeriod)
	{
		bytes32 position = minWaitingPeriodPos;
	    assembly {
	        _minWaitingPeriod := sload(position)
	    }
	}

	function scheduledTimestamp()
		public
		view
		returns (uint _timestamp)
	{
		bytes32 position = scheduledTimestampPos;
	    assembly {
	        _timestamp := sload(position)
	    }
	}

	function scheduledImplementation()
		public
		view
		returns (address _implementation)
	{
		bytes32 position = scheduledImplementationPos;
		assembly {
		  _implementation := sload(position)
		}
	}

    function upgrade()
  	    public
  		onlyProxyOwner
    {
		require(scheduledTimestamp() <= now, "TOO_EARLY");

		address _implementation = scheduledImplementation();
		require(_implementation != address(0), "NOTHING_SCHEDULE");

		_upgradeTo(_implementation);

		setScheduledTimestamp(0);
		setScheduledImplementation(address(0));
    }

	function upgradeToAndCall(
		bytes memory data
		)
		payable
		public
		onlyProxyOwner
	{
		upgrade();
		(bool success, ) = address(this).call.value(msg.value)(data);
		require(success);
	}

	function upgradeToAndCall(
		address /* implementation */,
		bytes memory /* data */
		)
		payable
		public
		onlyProxyOwner
	{
		revert("use `upgradeToAndCall(bytes memory data)`");
	}

	function upgradeTo(
		address /* implementation */
		)
		public
		onlyProxyOwner
	{
		revert("use `upgrade()`");
	}

	// --- internal & private functions

    function setMinWaitingPeriod(
	  	uint _minWaitingPeriod
	  	)
	  	internal
  	{
  		bytes32 position = minWaitingPeriodPos;
	    assembly {
	        sstore(position, _minWaitingPeriod)
	    }
	}

    function setScheduledTimestamp(
	  	uint _timestamp
	  	)
	  	internal
  	{
  		bytes32 position = scheduledTimestampPos;
	    assembly {
	        sstore(position, _timestamp)
	    }
	}

	function setScheduledImplementation(
	  	address _implementation
	  	)
	  	internal
  	{
  		bytes32 position = scheduledImplementationPos;
	    assembly {
	        sstore(position, _implementation)
	    }
	}
}