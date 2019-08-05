
// This code is taken from https://github.com/OpenZeppelin/openzeppelin-labs
// with minor modifications.

pragma solidity 0.5.10;

import '../thirdparty/OwnedUpgradeabilityProxy.sol';

/**
 * @title OwnedScheduleUpgradabilityProxy
 */
contract OwnedScheduleUpgradabilityProxy is OwnedUpgradeabilityProxy {

	event UpgradeScheduled(uint timestamp, address newImplementation);
	event UpgradeCancelled(uint timestamp);

	// Storage position of the owner of the contract
	bytes32 private constant scheduledImplementationPosition = keccak256("org.loopring.proxy.scheduled.implementation");
	bytes32 private constant scheduledTimestampPosition = keccak256("org.loopring.proxy.scheduled.timestamp");

	constructor() public OwnedUpgradeabilityProxy() {}

	function scheduleUpgrade(
		uint 	_timestamp,
		address _impl
		)
		public
		onlyProxyOwner
	{
		require(_timestamp >= now + (30 days),"INVALID_TIMESTAMP");
		require(_impl != implementation(), "SAME_ADDRESS");

		setScheduledTimestamp(_timestamp);
		setScheduledImplementation(_impl);
		emit UpgradeScheduled(_timestamp, _impl);
	}

	function cancelScheduledUpgrade()
		public
		onlyProxyOwner {
		require(scheduledImplementation() != address(0), "SAME_ADDRESS");

		setScheduledTimestamp(now);
		setScheduledImplementation(address(0));
		emit UpgradeCancelled(now);
	}

	function scheduledTimestamp()
		public
		view
		returns (uint _timestamp)
	{
		bytes32 position = scheduledTimestampPosition;
	    assembly {
	        _timestamp := sload(position)
	    }
	}

	function scheduledImplementation()
		public
		view
		returns (address _impl)
	{
		bytes32 position = scheduledImplementationPosition;
		assembly {
		  _impl := sload(position)
		}
	}

    function upgrade()
  	    public
  		onlyProxyOwner
    {
		require(scheduledTimestamp() <= now, "TOO_EARLY");

		address newImplementation = scheduledImplementation();
		require(newImplementation != address(0), "NO_SCHEDULE");

		_upgradeTo(newImplementation);

		setScheduledTimestamp(now);
		setScheduledImplementation(address(0));
		emit Upgraded(newImplementation);
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
    function setScheduledTimestamp(
	  	uint _timestamp
	  	)
	  	internal
  	{
  		bytes32 position = scheduledTimestampPosition;
	    assembly {
	        sstore(position, _timestamp)
	    }
	}

	function setScheduledImplementation(
	  	address _impl
	  	)
	  	internal
  	{
  		bytes32 position = scheduledImplementationPosition;
	    assembly {
	        sstore(position, _impl)
	    }
	}
}