
# The Simulation of Rate and Margin Calculation in Protocol 2.0


## What you can learn from this simulation:
1. miners no longer need to supply rateAmountS/reateAmountB to calculate the real trading rate (in protocol v1 miners have to provide these two numbers and smart contracts verifies these numbers). This will reduce the size of ring data and computation gas usage. This is possible in v2 as the actual fill rate of each order is the rate specified by the order.
2. margin is only calculated and paid in tokenS. TokenB is no longer part of the margin calculation.
3. calculation of the actual fill rate and margin is simplier than in v1.

## How to run the code
Copy the code below and save it in a file named 'simulator.scala', then run `scala path/to/simulator.scala`.

## The Code

```scala

// Author: Daniel Wang
// This is a simulation of Loopring Protocol V2's settlement part but without considering  fees.

// @amountS is the real size of tokenS to sell, after considering balance and allowance.
// @amountB is the real size of tokenB to buy.
// @dealAmountB is the amount of tokenB to receive from the next order in the ring.
// @dealAmountS is the amount of tokenS to pay to the previous order in the ring.
// @marginS is the amount of tokenS to pay to the miner and wallet.
// Note that there is no marginB any more.

case class Order(
  val amountS: Long,
  val amountB: Long) {
  var dealAmountB: Long = amountB; // defaults to amountB
  var dealAmountS: Long = amountS; // defaults to amountS
  var marginS: Long = 0; // defaults to 0

  // The rate can also be seen as the price of 1 unit of tokenS measured by tokenB.
  def rate = amountB.toDouble / amountS

  override def toString() = s"\tamountS $amountS\n\tamountB: $amountB\n\trate: $rate\n\tdealAmountS: $dealAmountS\n\tdealAmountB: $dealAmountB\n\tmarginS: $marginS\n"
}

class Ring(orders: Seq[Order]) {
  val rate = orders.map(_.rate).reduce(_ * _)

  override def toString() = {
    val str = orders.zipWithIndex.map { case (o, i) => s"$i:    $o\n" }.mkString
    s"rate: $rate\n$str"
  }

  def settle(): Boolean = {
    var smallest = 0;

    def resize(i: Int) {
      val j = (i + 1) % orders.size
      val o1 = orders(i)
      val o2 = orders(j)

      // in each ring, next order sells to the prevous one
      if (o2.dealAmountS < o1.dealAmountB) {
        smallest = j;
        o1.dealAmountB = o2.dealAmountS
        o1.dealAmountS = (o1.dealAmountB / o1.rate).toLong
      }
    }
    // First step is to make sure we resize all orders
    (0 until orders.size) foreach resize
    (0 until smallest) foreach resize

    // Second step would be make sure no margin is < 0,
    // otherwise, the ring is not settlable.
    // In protocol 2.0 we no longer use the product of all orders'
    // `rate` to check if it is <= 1.0, as in protocol 1.
    // We no longer require miners to supply a rateAmountS or rateAmountB.
    try {
      (0 until orders.size) foreach { i =>
        val j = (i + 1) % orders.size
        val o1 = orders(i)
        val o2 = orders(j)
        if (o2.dealAmountS < o1.dealAmountB) {
          throw new Exception("unsettlable ring")
        }
        o2.marginS = o2.dealAmountS - o1.dealAmountB
        o2.dealAmountS = o1.dealAmountB
      }
    } catch {
      case e: Throwable => return false;
    }
    return true;
  }
}

object Protoco2RateSimulator {
  def main(args: Array[String]) {
    // make the nubmers a big larger to precise the calculation.
    val orders = Seq(
      Order((10 * 1000000).toLong, 100 * 1000000),
      Order(100 * 1000000, 10 * 1000000))

    // The sequence order of `orders` shound't matter.
    val ring = new Ring(orders)
    // val ring = new Ring(orders.reverse)
    println("settable: " + ring.settle())
    println(ring)
  }
}
```
