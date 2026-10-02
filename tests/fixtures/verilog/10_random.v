module tb;
  integer i; reg [7:0] r;
  initial begin
    for (i = 0; i < 6; i = i + 1) begin r = $random; $display("%d %h", $random, r); end
    $finish;
  end
endmodule
